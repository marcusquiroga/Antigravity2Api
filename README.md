# Antigravity2Api Documentation

## Overview
Antigravity2Api is a service that seamlessly converts the Antigravity proxy into standard Claude API and Gemini API interfaces. This enables functionality that is both powerful and easy to use for developers.

## Features
- **MCP XML Bridge**: Facilitate interaction with different systems through the MCP XML Bridge functionality.
- **Function Calling**: Invoke functions directly within your applications.
- **Subagent Support**: Manage subagents effectively to enhance the functionality of your API.
- **Structured Output**: Receive responses in a structured format that is easy to parse and understand.
- **Streaming Thoughts**: Handle real-time output to improve interactivity in your applications.
- **Thought Signature Verification**: Ensure the authenticity of the thoughts processed by the API.
- **Image Generation**: Generate images on-the-fly based on the requirements of your application.
- **Web Search**: Implement web search capabilities directly within your API calls.
- **Token Counting**: Monitor and manage token usage efficiently.
- **Account Switching**: Switch between accounts seamlessly without disrupting service.

## Environment Setup
### Requirements
- Ensure that you have a compatible operating system (Linux, Windows, or macOS).
- Minimum system requirements include 8 GB of RAM and sufficient disk space for Docker containers.

### Installation Steps
1. **Install Docker**: Follow the [official Docker guide](https://docs.docker.com/get-docker/) for your operating system.
2. **Clone the Repository**:
   ```bash
   git clone https://github.com/marcusquiroga/Antigravity2Api.git
   cd Antigravity2Api
   ```

## Configuration
- Configure your API keys and other necessary credentials in the configuration file located at `config.json`.

## Docker Deployment
- Build and run the Docker container:
   ```bash
   docker build -t antigravity2api .
   docker run -d -p 8080:8080 antigravity2api
   ```

## Client Connection
- Connect to the Antigravity2Api service using HTTP requests to `http://localhost:8080`.

## FAQ
**Q: How do I authenticate requests?**  
A: Include your API key in the request headers.

**Q: What are the default timeouts?**  
A: The default timeout for requests is set to 30 seconds, which you can adjust in your configuration file.
