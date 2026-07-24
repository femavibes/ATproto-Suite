#!/bin/bash

# Initialize data files for daily-content-bot

echo "🔧 Initializing data files..."

# Create data directory
mkdir -p data

# Create empty JSON files if they don't exist
create_if_missing() {
    local file="$1"
    local content="$2"
    
    if [ ! -f "$file" ]; then
        echo "$content" > "$file"
        echo "✅ Created $file"
    else
        echo "⏭️  $file already exists, skipping"
    fi
}

# Initialize data files
create_if_missing "data/quotes.json" "[]"
create_if_missing "data/words.json" "[]"
create_if_missing "data/used_quotes.json" "[]"
create_if_missing "data/used_words.json" "[]"
create_if_missing "data/quote_categories.json" "[]"
create_if_missing "data/word_categories.json" "[]"
create_if_missing "data/quote_seasonal_periods.json" "{}"
create_if_missing "data/word_seasonal_periods.json" "{}"

# Create uploads directory
mkdir -p uploads

echo ""
echo "🎉 Data initialization complete!"
echo "📁 Your data files are in the ./data/ directory"
echo "🖼️  Image uploads will go to ./uploads/ directory"
echo ""
echo "Next steps:"
echo "1. Run the bot: npm start"
echo "2. Visit http://localhost:3000"
echo "3. Add your quotes and words through the web interface"