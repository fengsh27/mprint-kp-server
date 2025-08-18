#!/bin/bash

# MPrint Knowledge Portal Server Deployment Script

echo "🚀 Building and deploying MPrint Knowledge Portal Server..."

# Build the Docker image
echo "📦 Building Docker image..."
docker build -t mprint-kp-server .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    
    # Stop and remove existing container if it exists
    echo "🔄 Stopping existing container..."
    docker stop mprint-kp-server 2>/dev/null || true
    docker rm mprint-kp-server 2>/dev/null || true
    
    # Run the new container
    echo "🚀 Starting new container..."
    docker run -d \
        --name mprint-kp-server \
        -p 3000:3000 \
        --restart unless-stopped \
        mprint-kp-server
    
    if [ $? -eq 0 ]; then
        echo "✅ Container started successfully!"
        echo "🌐 Application is running at: http://localhost:3000"
        echo "📊 Health check endpoint: http://localhost:3000/api/test"
        echo ""
        echo "📋 Container logs:"
        docker logs mprint-kp-server
    else
        echo "❌ Failed to start container"
        exit 1
    fi
else
    echo "❌ Docker build failed!"
    exit 1
fi
