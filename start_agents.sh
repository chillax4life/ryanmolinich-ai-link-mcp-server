#!/bin/bash
# Load environment from .env file
cd "$(dirname "$0")"
node --env-file=.env agents/run_demo.js "$@"