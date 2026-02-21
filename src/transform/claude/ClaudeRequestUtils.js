/**
 * Shared helpers for ClaudeRequestIn.
 * Keep these pure / side-effect free so they’re safe to reuse.
 */

/**
 * 将 schema 类型转换为大写
 */
function uppercaseSchemaTypes(schema) {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(uppercaseSchemaTypes);

  const normalized = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type") {
      if (typeof value === "string") {
        normalized[key] = value.toUpperCase();
      } else if (Array.isArray(value)) {
        normalized[key] = value.map((item) => (typeof item === "string" ? item.toUpperCase() : item));
      } else {
        normalized[key] = value;
      }
      continue;
    }
    normalized[key] = typeof value === "object" && value !== null ? uppercaseSchemaTypes(value) : value;
  }
  return normalized;
}

function mergeEnumAnyOf(anyOf) {
  if (!Array.isArray(anyOf) || anyOf.length === 0) return null;

  let mergedType = null;
  const mergedEnum = [];
  const seen = new Set();
  const allowedKeys = new Set(["type", "enum", "description", "title"]);

  for (const option of anyOf) {
    if (!option || typeof option !== "object" || Array.isArray(option)) return null;
    if (!Array.isArray(option.enum) || option.enum.length === 0) return null;

    if (option.type !== undefined) {
      if (typeof option.type !== "string" || option.type.length === 0) return null;
      if (mergedType === null) mergedType = option.type;
      else if (mergedType !== option.type) return null;
    }

    // Only merge simple enum options (avoid incorrectly flattening complex subschemas).
    for (const key of Object.keys(option)) {
      if (!allowedKeys.has(key)) return null;
    }

    for (const value of option.enum) {
      const token = `${typeof value}:${String(value)}`;
      if (seen.has(token)) continue;
      seen.add(token);
      mergedEnum.push(value);
    }
  }

  if (mergedEnum.length === 0) return null;
  return { type: mergedType, enum: mergedEnum };
}

/**
 * 清理 JSON Schema 以符合 Gemini 格式
 */
function cleanJsonSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;
  if (Array.isArray(schema)) return schema.map(cleanJsonSchema);

  const validationFields = {
    minLength: "minLength",
    maxLength: "maxLength",
    minimum: "minimum",
    maximum: "maximum",
    exclusiveMinimum: "exclusiveMinimum",
    exclusiveMaximum: "exclusiveMaximum",
    minItems: "minItems",
    maxItems: "maxItems",
  };
  const removeKeys = new Set([
    "$schema",
    "additionalProperties",
    "default",
    "uniqueItems",
    // v1internal Schema doesn't support JSON Schema draft keywords like `propertyNames`.
    "propertyNames",
    "patternProperties",
    "unevaluatedProperties",
  ]);
  let constValue;

  const validations = [];
  for (const [field, label] of Object.entries(validationFields)) {
    if (field in schema) {
      validations.push(`${label}: ${schema[field]}`);
    }
  }

  const cleaned = {};
  for (const [key, value] of Object.entries(schema)) {
    // Gemini Schema doesn't support JSON Schema "const"; map to enum([value]).
    if (key === "const") {
      constValue = value;
      continue;
    }

    if (removeKeys.has(key) || key in validationFields) continue;

    // `properties` is a map of propertyName -> schema. Preserve property names (e.g. a parameter named "format")
    // and only clean each property's schema value.
    if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      const cleanedProperties = {};
      for (const [propName, propSchema] of Object.entries(value)) {
        cleanedProperties[propName] =
          typeof propSchema === "object" && propSchema !== null ? cleanJsonSchema(propSchema) : propSchema;
      }
      cleaned.properties = cleanedProperties;
      continue;
    }

    // Normalize union types like ["string","null"] to a single type (prefer non-null)
    if (key === "type" && Array.isArray(value)) {
      const filtered = value.filter((v) => v !== "null");
      cleaned.type = filtered[0] || value[0] || "string";
      continue;
    }

    if (key === "description" && validations.length > 0) {
      cleaned[key] = `${value} (${validations.join(", ")})`;
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = cleanJsonSchema(value);
    } else {
      cleaned[key] = value;
    }
  }

  if (constValue !== undefined) {
    cleaned.enum = [constValue];
  }

  if (validations.length > 0 && !cleaned.description) {
    cleaned.description = `Validation: ${validations.join(", ")}`;
  }

  // v1internal / Claude-on-Vertex tool schemas reject JSON Schema combinators like `anyOf` in practice.
  // Flatten the common pattern of enum unions: { anyOf: [{type, enum}, ...] } -> { type, enum }.
  if (Array.isArray(cleaned.anyOf)) {
    const merged = mergeEnumAnyOf(cleaned.anyOf);
    if (merged) {
      delete cleaned.anyOf;
      if (merged.type && !cleaned.type) cleaned.type = merged.type;
      if (!cleaned.enum) cleaned.enum = merged.enum;
    }
  }

  return uppercaseSchemaTypes(cleaned);
}

function estimateBase64BytesLength(b64) {
  const s = String(b64 || "").trim();
  if (!s) return 0;
  let padding = 0;
  if (s.endsWith("==")) padding = 2;
  else if (s.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
}

function extractInlineDataPartsFromClaudeToolResultContent(rawContent) {
  if (!Array.isArray(rawContent)) {
    const text =
      typeof rawContent === "string"
        ? rawContent
        : rawContent && typeof rawContent === "object"
          ? JSON.stringify(rawContent)
          : String(rawContent || "");
    return { contentText: text, sanitizedContent: rawContent, inlineParts: [] };
  }

  const inlineParts = [];
  const sanitized = [];
  const textSegments = [];

  for (const block of rawContent) {
    if (block && typeof block === "object") {
      if (block.type === "text") {
        const t = typeof block.text === "string" ? block.text : "";
        if (t) textSegments.push(t);
        sanitized.push(block);
        continue;
      }

      if (block.type === "image") {
        const source = block.source && typeof block.source === "object" ? block.source : null;
        const data = source && typeof source.data === "string" ? source.data : null;
        const mimeType = source && (source.media_type || source.mediaType) ? (source.media_type || source.mediaType) : "image/png";
        if (data) {
          inlineParts.push({ inlineData: { mimeType, data } });
          const bytesLen = estimateBase64BytesLength(data);
          const placeholder = `[inline image omitted from JSON (${mimeType}, ~${bytesLen} bytes)]`;
          textSegments.push(placeholder);
          sanitized.push({
            ...block,
            source: {
              ...source,
              data: placeholder,
            },
          });
          continue;
        }
      }
    }

    // Fallback: preserve structure and provide a small textual hint.
    try {
      textSegments.push(typeof block === "string" ? block : JSON.stringify(block));
    } catch (_) {
      textSegments.push(String(block));
    }
    sanitized.push(block);
  }

  return {
    contentText: textSegments.join("\n"),
    sanitizedContent: inlineParts.length > 0 ? sanitized : rawContent,
    inlineParts,
  };
}

module.exports = {
  cleanJsonSchema,
  extractInlineDataPartsFromClaudeToolResultContent,
};
