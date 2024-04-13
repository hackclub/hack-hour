#!/bin/bash

# Ensure that the current working directory is the same as the directory containing the script
# If not, the script will fail to find the files it needs - change to the directory containing the script
if [ ! -f "entry.sh" ]; then
    echo "Changing to the directory containing the script"
    cd "$(dirname "$0")"
fi

# Run the script
npm run app