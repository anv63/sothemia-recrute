#!/usr/bin/env python3
"""
Run script for Smart AI Resume Analyzer
This script handles Chrome/chromedriver setup and starts the application
"""

import os
import sys
import subprocess
import platform

def main():
    """Main function to set up chromedriver and run the application"""
    print("Starting Smart AI Resume Analyzer...")
    
    # Sothema HR Intelligence does not require chromedriver (internal ATS mode)
    
    # Start the Streamlit application
    print("Starting application...")
    app_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py")
    
    if os.path.exists(app_script):
        try:
            # Use subprocess to run streamlit
            subprocess.run([sys.executable, "-m", "streamlit", "run", app_script])
        except Exception as e:
            print(f"Error starting application: {str(e)}")
            sys.exit(1)
    else:
        print(f"Application script not found at {app_script}")
        sys.exit(1)

if __name__ == "__main__":
    main() 