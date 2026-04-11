#!/bin/bash

# Open Connect Configuration UI - Quick Setup Script
# For: Paysys Labs | Client: Ethswitch
# Usage: bash setup.sh

set -e

echo "🚀 Open Connect Configuration UI - Setup Script"
echo "=============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install from https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo -e "${GREEN}✓${NC} npm version: $(npm -v)"
echo ""

# Create project directory
PROJECT_NAME="open-connect-config"

if [ -d "$PROJECT_NAME" ]; then
    echo -e "${YELLOW}⚠${NC} Directory '$PROJECT_NAME' already exists."
    read -p "Do you want to continue in existing directory? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${BLUE}📦${NC} Creating project directory..."
    mkdir -p $PROJECT_NAME
fi

cd $PROJECT_NAME

# Initialize package.json if not exists
if [ ! -f "package.json" ]; then
    echo -e "${BLUE}📦${NC} Initializing npm project..."
    npm init -y > /dev/null
fi

# Install dependencies
echo -e "${BLUE}📦${NC} Installing dependencies..."
echo "   Installing: react, react-dom, lucide-react"

npm install --legacy-peer-deps react react-dom lucide-react > /dev/null 2>&1 || npm install --legacy-peer-deps react react-dom lucide-react

echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Create src directory structure
echo -e "${BLUE}📁${NC} Setting up directory structure..."

mkdir -p src
mkdir -p public

# Create public/index.html if not exists
if [ ! -f "public/index.html" ]; then
    cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Open Connect Configuration UI</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
                sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script src="https://cdn.tailwindcss.com"></script>
</body>
</html>
EOF
fi

echo -e "${GREEN}✓${NC} Public directory set up"

# Create src/index.jsx
if [ ! -f "src/index.jsx" ]; then
    cat > src/index.jsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
fi

# Create src/App.jsx
if [ ! -f "src/App.jsx" ]; then
    cat > src/App.jsx << 'EOF'
import React from 'react';
import OpenConnectConfigUI from './OpenConnectConfigUI';

function App() {
  return <OpenConnectConfigUI />;
}

export default App;
EOF
fi

echo -e "${GREEN}✓${NC} Source files created"

# Create vite config for faster development
if [ ! -f "vite.config.js" ]; then
    cat > vite.config.js << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
})
EOF

    npm install -D vite @vitejs/plugin-react > /dev/null 2>&1

    # Update package.json scripts
    npm set-script dev "vite" > /dev/null 2>&1
    npm set-script build "vite build" > /dev/null 2>&1
    npm set-script preview "vite preview" > /dev/null 2>&1

    echo -e "${GREEN}✓${NC} Vite configured for faster development"
fi

echo ""
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "   1. Copy OpenConnectConfigUI.jsx to src/ directory"
echo "   2. Run development server:"
echo ""
echo -e "      ${YELLOW}npm run dev${NC}"
echo ""
echo "   3. Open http://localhost:3000 in your browser"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   - See IMPLEMENTATION_GUIDE.md for detailed usage"
echo "   - Reference Open_Connect_Configuration_Guide_v1_0.pdf"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   - Use Copilot in VS Code for code suggestions"
echo "   - Export SQL from the Review step"
echo "   - Test in DEV database before production"
echo ""
