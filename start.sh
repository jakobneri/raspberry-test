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

# Function to show menu with arrow key selection
show_menu() {
    local selected=0
    local options=(
        "Pull updates and start server"
        "Just start server (no update)"
        "Only pull updates (don't start)"
        "Exit"
    )
    
    while true; do
        clear
        echo -e "${BLUE}╔════════════════════════════════════════${NC}"
        echo -e "${BLUE}║  🥧 Raspberry Pi Server Manager 🥧   ║${NC}"
        echo -e "${BLUE}╔════════════════════════════════════════${NC}"
        echo ""
        echo -e "${YELLOW}What would you like to do?${NC}"
        echo ""
        
        for i in "${!options[@]}"; do
            if [ $i -eq $selected ]; then
                echo -e "${GREEN}▶ ${options[$i]}${NC}"
            else
                echo -e "  ${options[$i]}"
            fi
        done
        
        echo ""
        echo -e "${BLUE}Use ↑↓ arrow keys to navigate, Enter to select${NC}"
        
        # Read arrow keys
        read -rsn1 key
        if [[ $key == $'\x1b' ]]; then
            read -rsn2 key
            case $key in
                '[A') # Up arrow
                    ((selected--))
                    if [ $selected -lt 0 ]; then
                        selected=$((${#options[@]} - 1))
                    fi
                    ;;
                '[B') # Down arrow
                    ((selected++))
                    if [ $selected -ge ${#options[@]} ]; then
                        selected=0
                    fi
                    ;;
            esac
        elif [[ $key == "" ]]; then
            # Enter key pressed
            return $selected
        fi
    done
}

# Main loop
# Check if option was passed as command line argument
if [ $# -gt 0 ]; then
    choice=$1
else
    show_menu
    choice=$?
fi

while true; do
    clear
    case $choice in
        0)
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo -e "${BLUE}║  🥧 Raspberry Pi Server Manager 🥧   ║${NC}"
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo ""
            pull_updates
            start_server
            break
            ;;
        1)
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo -e "${BLUE}║  🥧 Raspberry Pi Server Manager 🥧   ║${NC}"
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo ""
            echo -e "${BLUE}Skipping updates...${NC}"
            start_server
            break
            ;;
        2)
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo -e "${BLUE}║  🥧 Raspberry Pi Server Manager 🥧   ║${NC}"
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo ""
            pull_updates
            echo -e "${GREEN}Done! Exiting...${NC}"
            break
            ;;
        3)
            echo ""
            echo -e "${GREEN}Goodbye! 👋${NC}"
            exit 0
            ;;
    esac
    
    # If we had a command line argument, exit after first iteration
    if [ $# -gt 0 ]; then
        break
    fi
    
    # Otherwise show menu again
    show_menu
    choice=$?
done
