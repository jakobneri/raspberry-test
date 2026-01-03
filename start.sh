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

echo ""
echo -e "${BLUE}>> Raspberry Pi Server Manager${NC}"
echo -e "${GREEN}   v1.0${NC}"
echo ""

# Function to check and install speedtest-cli
check_speedtest() {
    if ! command -v speedtest-cli &> /dev/null; then
        echo -e "${YELLOW}📡 speedtest-cli not found, installing...${NC}"
        if command -v pip3 &> /dev/null; then
            pip3 install speedtest-cli
        elif command -v pip &> /dev/null; then
            pip install speedtest-cli
        else
            echo -e "${RED}✗ pip not found, cannot install speedtest-cli${NC}"
            echo -e "${YELLOW}  Install manually: sudo apt install python3-pip && pip3 install speedtest-cli${NC}"
            return 1
        fi
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ speedtest-cli installed successfully!${NC}"
        else
            echo -e "${RED}✗ Failed to install speedtest-cli${NC}"
            return 1
        fi
        echo ""
    fi
    return 0
}

# Function to pull from git
pull_updates() {
    echo -e "${YELLOW}📥 Pulling latest changes from repository...${NC}"
    
    # Fix: Ensure database is not tracked by git to prevent overwriting
    if git ls-files --error-unmatch database.sqlite > /dev/null 2>&1; then
        echo -e "${YELLOW}🔧 Removing database.sqlite from git tracking (keeping local file)...${NC}"
        git rm --cached database.sqlite
        echo "database.sqlite" >> .gitignore
    fi

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
    
    # Capture git pull output to check if anything changed
    GIT_OUTPUT=$(git pull 2>&1)
    GIT_EXIT_CODE=$?
    
    if [ $GIT_EXIT_CODE -eq 0 ]; then
        # Ensure start.sh has execute permissions after pull
        chmod +x start.sh
        
        # Check if there were actual updates
        if echo "$GIT_OUTPUT" | grep -q "Already up to date"; then
            echo -e "${GREEN}✓ Repository already up to date - skipping build steps${NC}"
            echo ""
            return 0
        fi
        
        echo -e "${GREEN}✓ Successfully pulled latest changes!${NC}"
        
        # Display changes in requested format
        echo ""
        DIFF_STATS=$(git diff --numstat ORIG_HEAD HEAD)
        
        # Calculate max filename length for alignment
        MAX_LEN=0
        while read -r ins del name; do
            if [ -n "$name" ]; then
                LEN=${#name}
                if [ $LEN -gt $MAX_LEN ]; then MAX_LEN=$LEN; fi
            fi
        done <<< "$DIFF_STATS"
        
        # Add padding
        MAX_LEN=$((MAX_LEN + 3))
        
        while read -r insertions deletions filename; do
            if [ -n "$filename" ]; then
                if [ "$insertions" = "-" ]; then
                    printf "%-${MAX_LEN}s   (binary)\n" "$filename"
                else
                    printf "%-${MAX_LEN}s   ${GREEN}+ %3s${NC}   ${RED}- %3s${NC}\n" "$filename" "$insertions" "$deletions"
                fi
            fi
        done <<< "$DIFF_STATS"
        echo ""

        echo -e "${GREEN}✓ Restored execute permissions for start.sh${NC}"
        echo ""
        
        # Only install/build if there were updates
        echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
        npm install
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Backend dependencies installed successfully!${NC}"
        else
            echo -e "${RED}✗ Failed to install backend dependencies${NC}"
            echo -e "${RED}  Please check your internet connection or package.json${NC}"
            return 1
        fi
        echo ""
        
        # Build TypeScript backend
        echo -e "${YELLOW}🔨 Building TypeScript backend...${NC}"
        npm run build
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Backend build successful!${NC}"
        else
            echo -e "${RED}✗ Backend build failed${NC}"
            return 1
        fi
        echo ""
        
        # Build Angular frontend
        build_frontend
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ Frontend build failed${NC}"
            return 1
        fi
        
        # Check and install speedtest-cli if needed
        check_speedtest
        
        return 0
    else
        echo "$GIT_OUTPUT"
        echo -e "${RED}✗ Failed to pull changes${NC}"
        echo -e "${RED}  Please check your git configuration or internet connection${NC}"
        echo ""
        return 1
    fi
}

# Function to build Angular frontend
build_frontend() {
    echo -e "${YELLOW}🎨 Building Angular frontend...${NC}"
    
    # Check if frontend directory exists
    if [ ! -d "frontend" ]; then
        echo -e "${RED}✗ Frontend directory not found${NC}"
        return 1
    fi
    
    cd frontend
    
    # Install frontend dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        npm install
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ Failed to install frontend dependencies${NC}"
            cd ..
            return 1
        fi
    fi
    
    # Build Angular
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Angular build failed${NC}"
        cd ..
        return 1
    fi
    
    echo -e "${GREEN}✓ Angular frontend built successfully!${NC}"
    cd ..
    echo ""
    return 0
}

# Function to start the server
start_server() {
    echo -e "${GREEN}🚀 Starting server...${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo ""
    
    # Build Angular frontend if dist doesn't exist
    if [ ! -d "frontend/dist" ]; then
        build_frontend
        if [ $? -ne 0 ]; then
            return 1
        fi
    fi
    
    # Build TypeScript backend if dist doesn't exist
    if [ ! -d "dist" ]; then
        echo -e "${YELLOW}🔨 Building TypeScript backend...${NC}"
        npm run build
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ Backend build failed${NC}"
            return 1
        fi
        echo -e "${GREEN}✓ Backend built successfully!${NC}"
        echo ""
    fi
    
    # Get local IP address for display
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -z "$LOCAL_IP" ]; then
        LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
    fi
    
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}   Server starting on:${NC}"
    echo ""
    echo -e "   ${BLUE}➜${NC}  Local:   ${GREEN}http://localhost:3000${NC}"
    if [ "$LOCAL_IP" != "localhost" ]; then
        echo -e "   ${BLUE}➜${NC}  Network: ${GREEN}http://${LOCAL_IP}:3000${NC}"
    fi
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    
    while true; do
        npm start
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
        "🚀 Start Server (with git pull)"
        "▶️  Start Server (skip git pull)"
        "🔨 Rebuild Everything (frontend + backend)"
        "📥 Pull Updates Only (don't start server)"
        "👤 User Management (CLI)"
        "🚪 Exit"
    )
    
    while true; do
        clear
        echo -e "${BLUE}╔════════════════════════════════════════${NC}"
        echo -e "${BLUE}║  🥧 Raspberry Pi Server Manager 🥧   ║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════════${NC}"
        echo ""
        echo -e "${YELLOW}What would you like to do?${NC}"
        echo ""
        
        for i in "${!options[@]}"; do
            if [ $i -eq $selected ]; then
                echo -e "${GREEN}▶ $((i+1)). ${options[$i]}${NC}"
            else
                echo -e "  $((i+1)). ${options[$i]}"
            fi
        done
        
        echo ""
        echo -e "${BLUE}Use ↑↓ arrows or numbers 1-${#options[@]}, Enter to select${NC}"
        
        # Read input (arrow keys or numbers)
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
        elif [[ $key =~ ^[1-9]$ ]]; then
            # Number key pressed - validate against actual number of options
            local num=$((key - 1))
            if [ $num -ge 0 ] && [ $num -lt ${#options[@]} ]; then
                return $num
            fi
            # If invalid number, ignore and stay in loop
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
            echo -e "${YELLOW}🔄 Rebuilding everything...${NC}"
            echo ""
            # Remove old builds
            rm -rf dist frontend/dist
            # Build backend
            echo -e "${YELLOW}🔨 Building TypeScript backend...${NC}"
            npm run build
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✓ Backend built successfully!${NC}"
            else
                echo -e "${RED}✗ Backend build failed${NC}"
                break
            fi
            echo ""
            # Build frontend
            build_frontend
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✓ All builds completed!${NC}"
                echo ""
                start_server
            fi
            break
            ;;
        3)
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo -e "${BLUE}║  🥧 Raspberry Pi Server Manager 🥧   ║${NC}"
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo ""
            pull_updates
            echo -e "${GREEN}Done! Exiting...${NC}"
            break
            ;;
        4)
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo -e "${BLUE}║  🥧 Raspberry Pi Server Manager 🥧   ║${NC}"
            echo -e "${BLUE}╔════════════════════════════════════════${NC}"
            echo ""
            echo -e "${YELLOW}Starting CLI Manager...${NC}"
            npm run manage
            echo ""
            echo -e "${GREEN}Press Enter to return to menu...${NC}"
            read
            ;;
        5)
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
