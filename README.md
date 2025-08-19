# Adobe Hackathon Finale - Intelligent PDF Analysis Platform

A sophisticated PDF analysis platform that provides intelligent insights, cross-document connections, and interactive features for research and document analysis. Built with Python 3.11.9 and modern AI technologies.
## POWERSHELL COMMANDS

```powershell
docker build --platform linux/amd64 -t adobe-hackathon-finale .

docker run -d --name adobe-hackathon `
  -p 8080:8080 `
  -e LLM_PROVIDER=gemini `
  -e GEMINI_MODEL=gemini-2.0-flash `
  -e GOOGLE_API_KEY=AIzaSyCQyM9hfqmLXgnjhxS8PzfrAzk0RjZR4H4 `
  -e TTS_PROVIDER=azure_speech `
  -e AZURE_TTS_KEY=3Hjeod2UDdc0pLNh6Js5TyuG14cawwqbCceL3ARN56tDjmqiVal7JQQJ99BHACGhslBXJ3w3AAAYACOGH3Bu `
  -e AZURE_SPEECH_REGION=centralindia `
  -e ADOBE_EMBED_API_KEY=8fa6dfb2e75241cb9b270b3be9200651 `
  adobe-hackathon-finale
```

**See live logs (PowerShell):**
```powershell
docker logs -f adobe-hackathon
```

## 🚀 Key Features

### 📄 **Document Management & Analysis**
- **Bulk PDF Upload**: Upload multiple PDFs simultaneously with drag-and-drop interface
- **Advanced Document Indexing**: Pre-computed vector embeddings using `all-MiniLM-L6-v2` for lightning-fast search
- **Cross-Document Analysis**: Find connections, contradictions, and patterns across all uploaded documents
- **Smart Text Selection**: Select any text to get instant insights from related content across all documents
- **Document Clustering**: Automatic grouping of similar documents and content sections
- **Incremental Indexing**: Smart updates to document index without full rebuilds
- **Document Recommendations**: AI-powered suggestions for related documents and content

### 🧠 **Intelligent AI Analysis**
- **Semantic Search**: Find relevant content using AI-powered similarity matching across all documents
- **Cross-PDF Insights**: Discover overlapping, adjacent, contradictory, and relevant sections
- **Contradiction Detection**: Automatically identify conflicting information across multiple sources
- **Connection Mapping**: Find relationships, patterns, and dependencies between different documents
- **Content Summarization**: AI-generated summaries of selected text and document sections
- **Context-Aware Analysis**: LLM-powered understanding of document context and relationships

### 🎙️ **Advanced Audio & Podcast Features**
- **Two-Person Podcasts**: Generate engaging conversations about selected content with multiple conversation styles
- **Multiple Conversation Styles**: Academic, casual, and technical conversation modes
- **Cross-Document Discussions**: Compare and contrast information from multiple sources
- **Context-Aware Scripts**: LLM-generated scripts based on selected text and related insights
- **Azure Speech TTS**: High-quality text-to-speech with natural voice synthesis
- **Enhanced Podcast Generation**: AI-powered conversation scripts with intelligent topic flow

### ⚡ **Performance & Scalability**
- **Document Indexing**: Pre-computed embeddings stored on disk for instant search
- **Vector Storage**: Efficient storage of document chunks with metadata and relationships
- **Background Processing**: Non-blocking document indexing and analysis
- **Memory Optimization**: Smart chunking and caching for large document collections
- **Async Processing**: Support for long-running analysis tasks with progress tracking
- **Search Analytics**: Track and optimize search performance across documents

### 🔍 **Advanced Search & Discovery**
- **Multi-Modal Search**: Search by content, metadata, and document relationships
- **Search Count Tracking**: Monitor search patterns and popular queries
- **Incremental Updates**: Smart document index updates without full rebuilds
- **Cluster Analysis**: Group similar documents and content sections automatically
- **Recommendation Engine**: AI-powered suggestions for related content and documents

### 🎬 **Experimental Features**

#### **LiteAvatar Animated Video Generation** 🆕
- **Interactive User Experience**: Generate animated videos of people for enhanced podcast and content presentation
- **AI-Powered Animation**: LiteAvatar tool/model integration for realistic human animations
- **Content Visualization**: Transform text insights and podcast content into engaging visual experiences

> **⚠️ Experimental Feature - Limitations:**
> - **High Processing Requirements**: Requires significant CPU and GPU resources
> - **Extended Generation Time**: Video generation can take 10-30 minutes depending on content length
> - **Not Live-Integrated**: Currently available as a demonstration feature with sample content
> - **Resource Intensive**: Not suitable for real-time document analysis or live podcast generation
> - **Sample Implementation**: Includes a static demonstration video showcasing the capability

> **Note**: This feature demonstrates the potential for enhanced user interaction but is not integrated with live PDF insights or podcast audio generation due to computational constraints.

#### **PDF.js Text Selection Implementation** 🆕
- **Direct Text Selection**: Native text selection directly from PDF documents without additional steps
- **Seamless User Experience**: Click and drag to select text, instantly triggering analysis
- **Enhanced Interactivity**: Real-time text selection with immediate insight generation
- **Improved Workflow**: Eliminates the copy-paste button approach for more intuitive interaction

> **Implementation Evolution:**
> - **Initial Approach**: Adobe PDF Embed API with button-based text input (required copy-paste step)
> - **Enhanced Approach**: PDF.js integration for direct text selection and analysis
> - **User Experience**: Reduced from 2-step process (select + button) to 1-step process (direct select)
> - **Feature Compliance**: Meets the original requirement for direct text selection-based insights

> **Note**: While both approaches provide the same core functionality, the PDF.js implementation offers a more direct and user-friendly experience that better aligns with the intended feature requirements.

## 🏗️ Architecture

### **Document Processing Pipeline**
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

### **AI Analysis Flow**
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

### **Enhanced Features Architecture**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Document Input  │───▶│ AI Analysis      │───▶│ Multi-Modal     │
│                 │    │ Engine           │    │ Output          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ LiteAvatar       │
                       │ (Experimental)   │
                       └──────────────────┘
```

### **Text Selection Implementation Approaches**

#### **Adobe PDF Embed API Approach (Initial)**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ PDF Document    │───▶│ Text Selection   │───▶│ Copy to Button  │
│ (Adobe Embed)   │    │ (Manual Copy)    │    │ Input Field     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Analysis         │
                       │ Trigger          │
                       └──────────────────┘
```

#### **PDF.js Direct Selection Approach (Enhanced)**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ PDF Document    │───▶│ Direct Text      │───▶│ Instant         │
│ (PDF.js)        │    │ Selection        │    │ Analysis        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │ Cross-PDF        │
                       │ Insights         │
                       └──────────────────┘
```

**Key Differences:**
- **Adobe Approach**: 2-step process (select text → copy → paste → analyze)
- **PDF.js Approach**: 1-step process (select text → instant analysis)
- **User Experience**: PDF.js provides more intuitive and direct interaction
- **Feature Compliance**: PDF.js better meets the original requirement for direct text selection

## 🛠️ Installation & Setup

### **Prerequisites**
- **Python 3.11.9** (strictly required - no other versions supported)
- Docker 
- Adobe PDF Embed API key
- Google Gemini API key (for LLM features)
- Azure Speech Services key (for TTS features)

### **Quick Start**

#### **Option 1: Local Development (Recommended)**

1. **Clone the repository**
   ```bash
   git clone https://github.com/kushagra-a-singh/Adobe-Hackathon-2025_Team-Ctrl-Alt-Complete_Finale.git
   cd Adobe-Hackathon-2025_Team-Ctrl-Alt-Complete_Finale

   ```

2. **Create and activate virtual environment**
   ```bash
   # Windows
   python -m venv .venv
   .\.venv\Scripts\activate
   
   # Linux/Mac
   python3.11 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

5. **Start the server**
   ```bash
   # If using virtual environment
   ..\.venv\Scripts\python -m app.main --reload --llm gemini --gemini-model gemini-2.0-flash
   
   # If Python 3.11.9 is in PATH
   python -m app.main --reload --llm gemini --gemini-model gemini-2.0-flash
   ```

6. **Access the application**
   ```
   http://localhost:8080
   ```

#### **Option 2: Docker Deployment**

1. **Build the Docker image**
   ```bash
   docker build --platform linux/amd64 -t adobe-hackathon-finale .
   ```

2. **Run the container**
   ```bash
   docker run -d \
     --name adobe-hackathon \
     -p 8080:8080 \
     -e LLM_PROVIDER=gemini \
     -e GOOGLE_API_KEY=your_google_api_key \
     -e AZURE_TTS_KEY=your_AZURE_TTS_KEY \
     -e AZURE_SPEECH_REGION=your_azure_region \
     -e ADOBE_EMBED_API_KEY=your_adobe_api_key \
     adobe-hackathon-finale
   ```

3. **Access the application**
   ```
   http://localhost:8080
   ```

### **Environment Variables**

Create a `.env` file in the project root with the following configuration:

```bash
# =============================================================================
# LLM Configuration
# =============================================================================

# LLM Provider (gemini, ollama, openai)
LLM_PROVIDER=gemini

# Google Gemini API Configuration
GOOGLE_API_KEY=your_google_api_key_here

# Ollama Configuration (if using Ollama)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# =============================================================================
# Text-to-Speech Configuration
# =============================================================================

# TTS Provider (azure_speech, gcp_tts)
TTS_PROVIDER=azure_speech

# Azure Speech Services Configuration
AZURE_TTS_KEY=your_AZURE_TTS_KEY_here
AZURE_SPEECH_REGION=centralindia

# =============================================================================
# Adobe Configuration
# =============================================================================

# Adobe PDF Embed API Key
ADOBE_EMBED_API_KEY=your_adobe_embed_api_key_here

# =============================================================================
# Server Configuration
# =============================================================================

# Server host and port
HOST=localhost
PORT=8080

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:8080

# =============================================================================
# Development Configuration
# =============================================================================

# Environment (development, production)
NODE_ENV=development

# Logging level (DEBUG, INFO, WARNING, ERROR)
LOG_LEVEL=INFO

# Debug mode (true, false)
DEBUG=true

# =============================================================================
# Performance Configuration
# =============================================================================

# Document chunking settings
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
TOP_K_RESULTS=10
SIMILARITY_THRESHOLD=0.3

# =============================================================================
# Storage Configuration
# =============================================================================

# Maximum file upload size (in bytes)
MAX_FILE_SIZE=10485760

# Allowed file types
ALLOWED_EXTENSIONS=pdf

# =============================================================================
# Security Configuration
# =============================================================================

# Secret key for JWT tokens (generate a secure random string)
SECRET_KEY=your_secret_key_here

# API rate limiting
RATE_LIMIT_PER_MINUTE=100

# =============================================================================
# Monitoring & Analytics
# =============================================================================

# Enable performance monitoring
ENABLE_MONITORING=true

# Metrics collection interval (in seconds)
METRICS_INTERVAL=60

# =============================================================================
# Backup & Recovery
# =============================================================================

# Enable automatic backups
ENABLE_BACKUPS=false

# Backup interval (in hours)
BACKUP_INTERVAL=24

# Backup retention (in days)
BACKUP_RETENTION=7
```

**Required Variables for Basic Operation:**
- `GOOGLE_API_KEY` - For LLM features
- `AZURE_TTS_KEY` - For text-to-speech
- `AZURE_SPEECH_REGION` - For Azure Speech Services
- `ADOBE_EMBED_API_KEY` - For PDF viewing

**Optional Variables:**
- All other variables have sensible defaults and are optional
- Performance and security settings can be adjusted based on your needs
- Experimental features are disabled by default

## 📚 API Endpoints

### **Document Management**
- `POST /api/upload` - Upload PDF files with automatic indexing
- `GET /api/documents` - List all uploaded documents with metadata
- `DELETE /api/documents/{filename}` - Remove document and update index
- `GET /api/index/stats` - Get document index statistics and performance metrics
- `POST /api/index/rebuild` - Rebuild entire document index
- `GET /api/index/clusters` - Get document clustering information
- `GET /api/index/recommendations/{filename}` - Get AI-powered document recommendations
- `GET /api/index/incremental-status` - Check incremental indexing status
- `POST /api/index/incremental-update` - Perform smart index updates

### **Analysis & Search**
- `POST /api/analyze` - Comprehensive document analysis with async support
- `POST /api/analyze_async` - Start long-running analysis tasks
- `GET /api/analyze_progress` - Monitor analysis progress
- `GET /api/analyze_result` - Retrieve analysis results
- `POST /api/analyze_cancel` - Cancel running analysis tasks
- `POST /api/insights` - Generate insights from selected content
- `POST /api/document-search` - Semantic search across all documents
- `POST /api/text-selection` - Process text selection and find cross-PDF insights
- `GET /api/search_count` - Get search analytics and popular queries

### **Audio Generation**
- `POST /api/podcast` - Generate basic audio from text content
- `POST /api/enhanced-podcast` - Create two-person conversation podcasts

### **System & Configuration**
- `GET /api/health` - System health check and status
- `GET /api/config` - Get current configuration (Adobe API key, etc.)
- `GET /` - Main application interface

## 🎯 Usage Examples

### **Text Selection & Cross-PDF Insights**
1. Upload multiple research papers or documents
2. Open any document and select text of interest
3. View instant insights from related content across all documents
4. Jump to relevant sections with one-click navigation
5. Generate enhanced podcasts about the selected content
6. Explore document clusters and relationships

### **Document Search & Analysis**
```bash
# Search for specific concepts across all documents
curl -X POST http://localhost:8080/api/document-search \
  -H "Content-Type: application/json" \
  -d '{"query": "machine learning algorithms", "top_k": 10}'

# Get comprehensive document analysis
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"filename": "research_paper.pdf"}'
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

### **Document Index Management**
```bash
# Check index performance
curl http://localhost:8080/api/index/stats

# Get document recommendations
curl http://localhost:8080/api/index/recommendations/document.pdf

# Rebuild index if needed
curl -X POST http://localhost:8080/api/index/rebuild
```

## 🔧 Configuration & Optimization

### **Document Index Settings**
- **Chunk Size**: 1000 characters per chunk (configurable)
- **Overlap**: 200 characters between chunks for context continuity
- **Embedding Model**: `all-MiniLM-L6-v2` (384 dimensions, ~1.5KB per chunk)
- **Storage**: Efficient disk-based storage with metadata preservation
- **Performance**: Sub-second search across 30+ documents

### **Performance Tuning**
```python
# In document_index.py
CHUNK_SIZE = 1000          # Characters per chunk
CHUNK_OVERLAP = 200        # Overlap between chunks
TOP_K_RESULTS = 10         # Default search results
SIMILARITY_THRESHOLD = 0.3 # Minimum similarity score
```

### **Memory Management**
- **Smart Caching**: Only load necessary embeddings into memory
- **Chunk Optimization**: Efficient chunking strategy for large documents
- **Background Processing**: Non-blocking operations for better UX
- **Resource Monitoring**: Track memory usage and optimize accordingly

## 🧪 Testing & Development

### **Run Test Suite**
```bash
# Test basic functionality
python test_text_selection.py

# Test document indexing
python test_document_index.py

# Test all features
python test_all_features.py

# Test comprehensive fixes
python test_comprehensive_fixes.py
```

### **Performance Testing**
```bash
# Upload 30+ PDFs and test search performance
python test_document_index.py

# Test dual voice podcast generation
python test_dual_voice.py
```

### **Development Commands**
```bash
# Start with auto-reload
python -m app.main --reload --llm gemini --gemini-model gemini-2.0-flash
```

## 🚀 Performance Metrics

### **Search Performance**
- **Indexed Search**: < 2 second for 30 documents
- **Text Selection**: < 3 seconds for cross-PDF insights
- **Memory Usage**: ~50MB for 30 documents
- **Storage**: ~1MB per document (depending on size)

### **Scalability**
- **Documents**: Tested with 30+ documents
- **Chunks**: ~1000 chunks per document
- **Total Chunks**: 30,000+ chunks supported
- **Search Time**: Scales logarithmically with chunk count

### **Resource Requirements**
- **CPU**: Minimum 2 cores, recommended 4+ cores
- **Memory**: Minimum 4GB RAM, recommended 8GB+ RAM
- **Storage**: ~1MB per document for indexing
- **Network**: Stable internet for API calls (Gemini, Azure Speech)

## 🔍 Troubleshooting

### **Common Issues**

1. **Python Version Mismatch**
   ```bash
   # Ensure Python 3.11.9 is used
   python --version
   # Should show: Python 3.11.9
   ```

2. **Slow Search Performance**
   ```bash
   # Check if index exists
   curl http://localhost:8080/api/index/stats
   
   # Rebuild index if needed
   curl -X POST http://localhost:8080/api/index/rebuild
   ```

3. **Memory Issues**
   - Reduce chunk size in `document_index.py`
   - Increase system memory
   - Use smaller embedding model

4. **Index Corruption**
   ```bash
   # Remove and rebuild index
   rm -rf document_index/
   curl -X POST http://localhost:8080/api/index/rebuild
   ```

5. **API Key Issues**
   ```bash
   # Check configuration
   curl http://localhost:8080/api/config
   
   # Verify environment variables
   echo $GOOGLE_API_KEY
   echo $AZURE_TTS_KEY
   ```

### **Logs & Debugging**
```bash
# Check server logs for indexing progress
tail -f logs/app.log

# Enable debug mode
export LOG_LEVEL=DEBUG
python -m app.main --reload
```

### **Development Guidelines**
- **Python Version**: Strictly use Python 3.11.9
- **Testing**: Add tests for all new features
- **Documentation**: Update README and technical guides
- **Performance**: Consider impact on search and indexing performance

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Adobe PDF Embed API** for document viewing and interaction
- **Google Gemini** for advanced LLM capabilities
- **Azure Speech Services** for high-quality text-to-speech
- **Sentence Transformers** for semantic embeddings
- **FastAPI** for the modern web framework
- **PyMuPDF** for robust PDF processing
- **LiteAvatar** for experimental animated video generation
- **PDF.js** for enhanced text selection capabilities

---

**Built for Adobe Hackathon Finale** 🎉