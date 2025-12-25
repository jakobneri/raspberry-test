#!/bin/bash

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🥧 Raspberry Pi Server Manager 🥧   ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Function to pull from git
pull_updates() {
    echo -e "${YELLOW}📥 Pulling latest changes from repository...${NC}"
    
    # Check for local changes
    if ! git diff-index --quiet HEAD --; then
        echo -e "${YELLOW}⚠️  Local changes detected!${NC}"
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BRANCH_NAME="local-changes-${TIMESTAMP}"
        
        echo -e "${YELLOW}📦 Creating branch: ${BRANCH_NAME}${NC}"
        git checkout -b "${BRANCH_NAME}"
        git add -A
        git commit -m "Local changes before pull at ${TIMESTAMP}"
        echo -e "${GREEN}✓ Local changes saved to branch ${BRANCH_NAME}${NC}"
        
        # Switch back to main
        git checkout main
        echo ""
    fi
    
    git pull
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully pulled latest changes!${NC}"
        echo ""
        
        # Ensure start.sh has execute permissions after pull
        chmod +x start.sh
        echo -e "${GREEN}✓ Restored execute permissions for start.sh${NC}"
        echo ""
        
        # Always install/update dependencies after pull
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        npm install --production
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ All dependencies installed successfully!${NC}"
        else
            echo -e "${RED}✗ Failed to install dependencies${NC}"
            echo -e "${RED}  Please check your internet connection or package.json${NC}"
            return 1
        fi
        echo ""
        return 0
    else
        echo -e "${RED}✗ Failed to pull changes${NC}"
        echo -e "${RED}  Please check your git configuration or internet connection${NC}"
        echo ""
        return 1
    fi
}

# Function to start the server
start_server() {
    echo -e "${GREEN}🚀 Starting server...${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo ""
    
    while true; do
        node server.js
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 42 ]; then
            echo ""
            echo -e "${YELLOW}🔄 Server restarting...${NC}"
            echo ""
            sleep 1
        else
            echo ""
            echo -e "${GREEN}Server stopped (exit code: $EXIT_CODE)${NC}"
            break
        fi
    done
}

# Main menu
show_menu() {
    echo ""
    echo -e "${YELLOW}What would you like to do?${NC}"
    echo ""
    echo "  1) Pull updates and start server"
    echo "  2) Just start server (no update)"
    echo "  3) Only pull updates (don't start)"
    echo "  4) Exit"
    echo ""
    echo -n "Enter your choice [1-4]: "
}

# Main loop
while true; do
    show_menu
    read choice
    
    case $choice in
        1)
            echo ""
            pull_updates
            start_server
            break
            ;;
        2)
            echo ""
            echo -e "${BLUE}Skipping updates...${NC}"
            start_server
            break
            ;;
        3)
            echo ""
            pull_updates
            echo -e "${GREEN}Done! Exiting...${NC}"
            break
            ;;
        4)
            echo ""
            echo -e "${GREEN}Goodbye! 👋${NC}"
            exit 0
            ;;
        *)
            echo ""
            echo -e "${RED}Invalid option. Please choose 1-4.${NC}"
            ;;
    esac
done
