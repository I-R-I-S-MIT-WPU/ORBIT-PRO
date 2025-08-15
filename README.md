# Adobe Hackathon Finale - Intelligent PDF Analysis Platform

A sophisticated PDF analysis platform that provides intelligent insights, cross-document connections, and interactive features for research and document analysis.

## 🚀 Key Features

### 📄 **Document Management**
- **Bulk PDF Upload**: Upload multiple PDFs simultaneously
- **Document Indexing**: Pre-computed vector embeddings for lightning-fast search
- **Cross-Document Analysis**: Find connections across all uploaded documents
- **Smart Text Selection**: Select any text to get instant insights from related content

### 🧠 **Intelligent Analysis**
- **Semantic Search**: Find relevant content using AI-powered similarity matching
- **Cross-PDF Insights**: Discover overlapping, adjacent, contradictory, and relevant sections
- **Contradiction Detection**: Automatically identify conflicting information across documents
- **Connection Mapping**: Find relationships and patterns between different sources

### 🎙️ **Enhanced Audio Features**
- **Two-Person Podcasts**: Generate engaging conversations about selected content
- **Multiple Styles**: Academic, casual, and technical conversation styles
- **Cross-Document Discussions**: Compare and contrast information from multiple sources
- **Context-Aware Scripts**: LLM-generated scripts based on selected text and related insights

### ⚡ **Performance Optimizations**
- **Document Indexing**: Pre-computed embeddings stored on disk for instant search
- **Vector Storage**: Efficient storage of document chunks with metadata
- **Background Processing**: Non-blocking document indexing and analysis
- **Memory Optimization**: Smart chunking and caching for large document collections

## 🏗️ Architecture

### **Document Indexing System**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PDF Upload    │───▶│  Document Index  │───▶│  Vector Storage │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Semantic Search  │
                       └──────────────────┘
```

### **Text Selection Flow**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Text Selection  │───▶│  Indexed Search  │───▶│ Cross-PDF       │
│                 │    │                  │    │ Insights        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Enhanced Podcast │
                       └──────────────────┘
```

## 🛠️ Installation

### Prerequisites
- Python 3.8+
- Docker (optional)
- Adobe PDF Embed API key

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Adobe-Hackathon-Finale
   ```

2. **Install dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the server**
   ```bash
   python -m app.main
   ```

5. **Access the application**
   ```
   http://localhost:8080
   ```

### Docker Deployment
```bash
docker build --platform linux/amd64 -t adobe-hackathon-finale .
docker run -e LLM_PROVIDER=gemini -e GOOGLE_API_KEY=$GOOGLE_API_KEY -p 8080:8080 adobe-hackathon-finale
```

## 📚 API Endpoints

### **Document Management**
- `POST /api/upload` - Upload PDF files
- `GET /api/documents` - List uploaded documents
- `GET /api/index/stats` - Get document index statistics
- `POST /api/index/rebuild` - Rebuild document index

### **Analysis & Search**
- `POST /api/analyze` - Analyze documents for sections and insights
- `POST /api/document-search` - Semantic search across documents
- `POST /api/text-selection` - Process text selection and find cross-PDF insights
- `POST /api/insights` - Generate insights from selected content

### **Audio Generation**
- `POST /api/podcast` - Generate basic audio from text
- `POST /api/enhanced-podcast` - Create two-person conversation podcast

### **System**
- `GET /api/health` - System health check
- `GET /api/config` - Get configuration (Adobe API key)

## 🔧 Configuration

### Environment Variables
```bash
# LLM Configuration
LLM_PROVIDER=gemini  # gemini, ollama, openai
GOOGLE_API_KEY=your_google_api_key
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_API_KEY=your_openai_api_key

# TTS Configuration
TTS_PROVIDER=azure_speech  # azure_speech, gcp_tts
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region

# Adobe Configuration
ADOBE_EMBED_API_KEY=your_adobe_embed_api_key
```

## 📊 Document Indexing

### **How It Works**
1. **Upload**: PDFs are automatically indexed when uploaded
2. **Chunking**: Documents are split into overlapping chunks (1000 chars, 200 overlap)
3. **Embedding**: Each chunk gets a vector embedding using `all-MiniLM-L6-v2`
4. **Storage**: Embeddings and metadata are stored on disk for fast retrieval
5. **Search**: Semantic search uses pre-computed embeddings for instant results

### **Performance Benefits**
- **Fast Search**: Sub-second search across 30+ documents
- **Memory Efficient**: Only loads embeddings, not full documents
- **Scalable**: Handles large document collections efficiently
- **Persistent**: Index survives server restarts

### **Index Management**
```bash
# Check index statistics
curl http://localhost:8080/api/index/stats

# Rebuild index (if needed)
curl -X POST http://localhost:8080/api/index/rebuild
```

## 🎯 Usage Examples

### **Text Selection & Cross-PDF Insights**
1. Upload multiple research papers
2. Open any document and select text
3. View instant insights from related content across all documents
4. Jump to relevant sections with one click
5. Generate enhanced podcasts about the selected content

### **Document Search**
```bash
# Search for specific concepts
curl -X POST http://localhost:8080/api/document-search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning algorithms", "top_k": 10}'
```

### **Enhanced Podcast Generation**
```bash
# Create two-person conversation about selected text
curl -X POST http://localhost:8080/api/enhanced-podcast \
  -H "Content-Type: application/json" \
  -d '{
    "selected_text": "neural network architecture",
    "related_insights": [...],
    "document": "research_paper.pdf",
    "conversation_style": "academic"
  }'
```

## 🧪 Testing

### **Run Test Suite**
```bash
# Test basic functionality
python test_text_selection.py

# Test document indexing
python test_document_index.py
```

### **Performance Testing**
```bash
# Upload 30+ PDFs and test search performance
python test_document_index.py
```

## 🔍 Technical Details

### **Document Index Structure**
```
document_index/
├── chunks.pkl          # Serialized document chunks with embeddings
├── metadata.json       # Document metadata and file hashes
└── models/             # Cached embedding models
```

### **Chunking Strategy**
- **Size**: 1000 characters per chunk
- **Overlap**: 200 characters between chunks
- **Boundaries**: Break at sentence endings when possible
- **Metadata**: Store document, page, and chunk index

### **Embedding Model**
- **Model**: `all-MiniLM-L6-v2` (384 dimensions)
- **Performance**: Fast inference, good semantic understanding
- **Storage**: ~1.5KB per chunk embedding
- **Fallback**: Hash-based embedding if model unavailable

### **Search Algorithm**
1. **Query Embedding**: Convert search query to vector
2. **Cosine Similarity**: Compute similarity with all chunks
3. **Ranking**: Sort by similarity score
4. **Filtering**: Apply document filters if specified
5. **Results**: Return top-k most similar chunks

## 🚀 Performance Metrics

### **Search Performance**
- **Indexed Search**: < 1 second for 30 documents
- **Text Selection**: < 2 seconds for cross-PDF insights
- **Memory Usage**: ~50MB for 30 documents
- **Storage**: ~1MB per document (depending on size)

### **Scalability**
- **Documents**: Tested with 30+ documents
- **Chunks**: ~1000 chunks per document
- **Total Chunks**: 30,000+ chunks supported
- **Search Time**: Scales logarithmically with chunk count

## 🔧 Troubleshooting

### **Common Issues**

1. **Slow Search Performance**
   ```bash
   # Check if index exists
   curl http://localhost:8080/api/index/stats
   
   # Rebuild index if needed
   curl -X POST http://localhost:8080/api/index/rebuild
   ```

2. **Memory Issues**
   - Reduce chunk size in `document_index.py`
   - Increase system memory
   - Use smaller embedding model

3. **Index Corruption**
   ```bash
   # Remove and rebuild index
   rm -rf document_index/
   curl -X POST http://localhost:8080/api/index/rebuild
   ```

### **Logs**
```bash
# Check server logs for indexing progress
tail -f logs/app.log
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Adobe PDF Embed API for document viewing
- Sentence Transformers for semantic embeddings
- FastAPI for the web framework
- PyMuPDF for PDF processing

---

**Built for Adobe Hackathon Finale** 🎉
