# Import required FastAPI components for building the API
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
# Import Pydantic for data validation and settings management
from pydantic import BaseModel
# Import OpenAI client for interacting with OpenAI's API
from openai import OpenAI
import os
from typing import Optional, List
import tempfile
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.openai_utils.chatmodel import ChatOpenAI
import uuid

# Initialize FastAPI application with a title
app = FastAPI(title="OpenAI Chat API")

# Configure CORS (Cross-Origin Resource Sharing) middleware
# This allows the API to be accessed from different domains/origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows requests from any origin
    allow_credentials=True,  # Allows cookies to be included in requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers in requests
)

# Define the data model for chat requests using Pydantic
# This ensures incoming request data is properly validated
class Message(BaseModel):
    role: str  # 'user' or 'assistant' (or 'system')
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]  # Array of messages
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication
    deep_dive: Optional[bool] = False  # Optional deep_dive flag

# In-memory storage for PDF sessions (session_id -> vector DB)
pdf_sessions = {}

@app.post("/api/upload_pdf")
async def upload_pdf(file: UploadFile = File(...), api_key: str = Form(None)):
    """
    Accepts a PDF file, indexes it, and returns a session id for chat.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    try:
        # Save PDF to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        # Load and split PDF
        loader = PDFLoader(tmp_path)
        documents = loader.load_documents()
        splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_texts(documents)
        # Build vector DB
        embedding_model = EmbeddingModel(api_key=api_key)
        vector_db = await VectorDatabase(embedding_model).abuild_from_list(chunks)
        # Store in session
        session_id = str(uuid.uuid4())
        pdf_sessions[session_id] = {
            "vector_db": vector_db,
            "chunks": chunks
        }
        return {"session_id": session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

class PDFChatRequest(BaseModel):
    session_id: str
    query: str
    model: Optional[str] = "gpt-4.1-mini"
    api_key: Optional[str] = None  # If not provided, use env var
    k: Optional[int] = 4  # Number of relevant chunks to retrieve

@app.post("/api/pdf_chat")
async def pdf_chat(request: PDFChatRequest):
    """
    Accepts a session id and user query, performs RAG over the indexed PDF, and returns an answer.
    """
    session = pdf_sessions.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    vector_db = session["vector_db"]
    chunks = session["chunks"]
    # Retrieve top-k relevant chunks
    relevant_chunks = vector_db.search_by_text(request.query, k=request.k, return_as_text=True)
    context = "\n---\n".join(relevant_chunks)
    # Compose prompt
    prompt = f"You are a helpful assistant. Use the following PDF context to answer the user's question.\n\nContext:\n{context}\n\nQuestion: {request.query}\nAnswer:"
    messages = [
        {"role": "system", "content": "You are a helpful assistant for answering questions about a PDF."},
        {"role": "user", "content": prompt}
    ]
    # Use provided API key or default
    chat_model = ChatOpenAI(model_name=request.model, api_key=request.api_key)
    answer = chat_model.run(messages)
    return {"answer": answer}

# Define the main chat endpoint that handles POST requests
@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        # Initialize OpenAI client with the provided API key
        client = OpenAI(api_key=request.api_key)
        
        # Create an async generator function for streaming responses
        async def generate():
            # Create a streaming chat completion request
            stream = client.chat.completions.create(
                model=request.model,
                messages=[{"role": m.role, "content": m.content} for m in request.messages],
                stream=True  # Enable streaming response
            )
            
            # Yield each chunk of the response as it becomes available
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    yield chunk.choices[0].delta.content

        # Return a streaming response to the client
        return StreamingResponse(generate(), media_type="text/plain")
    
    except Exception as e:
        # Handle any errors that occur during processing
        raise HTTPException(status_code=500, detail=str(e))

# Define a health check endpoint to verify API status
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Entry point for running the application directly
if __name__ == "__main__":
    import uvicorn
    # Start the server on all network interfaces (0.0.0.0) on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
