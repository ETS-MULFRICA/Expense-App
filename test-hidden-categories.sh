#!/bin/bash

# Test script for hidden categories functionality
echo "Testing Hidden Categories API endpoints..."

# First, let's see what categories are available
echo "1. Fetching available expense categories..."
curl -s "http://localhost:5000/api/expense-categories" | jq .

echo -e "\n2. Checking hidden categories (should be empty initially)..."
curl -s "http://localhost:5000/api/hidden-categories" | jq .

echo -e "\n3. Testing hide system category (assuming category ID 1 exists)..."
curl -s -X DELETE "http://localhost:5000/api/expense-categories/1" | jq .

echo -e "\n4. Checking hidden categories after hiding one..."
curl -s "http://localhost:5000/api/hidden-categories" | jq .

echo -e "\n5. Testing restore hidden category..."
curl -s -X POST "http://localhost:5000/api/hidden-categories/1/restore" \
  -H "Content-Type: application/json" \
  -d '{"categoryType": "expense"}' | jq .

echo -e "\n6. Final check - hidden categories should be empty again..."
curl -s "http://localhost:5000/api/hidden-categories" | jq .

echo -e "\nTest completed!"