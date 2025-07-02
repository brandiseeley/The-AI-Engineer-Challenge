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
import uuid
from aimakerspace.text_utils import PDFLoader, CharacterTextSplitter
from aimakerspace.openai_utils.embedding import EmbeddingModel
from aimakerspace.vectordatabase import VectorDatabase
from aimakerspace.openai_utils.chatmodel import ChatOpenAI

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
class ChatRequest(BaseModel):
    developer_message: str  # Message from the developer/system
    user_message: str      # Message from the user
    model: Optional[str] = "gpt-4.1-mini"  # Optional model selection with default
    api_key: str          # OpenAI API key for authentication

# In-memory store for PDF sessions: {session_id: { 'vectordb': VectorDatabase, 'chunks': List[str] }}
pdf_sessions = {}

@app.post("/api/upload_pdf")
async def upload_pdf(file: UploadFile = File(...), api_key: str = Form(...)):
    """
    Accepts a PDF file, indexes it, and returns a session ID.
    """
    try:
        # Save uploaded PDF to a temp file
        temp_path = f"/tmp/{uuid.uuid4()}.pdf"
        with open(temp_path, "wb") as f:
            f.write(await file.read())

        # Extract text from PDF
        loader = PDFLoader(temp_path)
        documents = loader.load_documents()
        text = "\n".join(documents)

        # Split text into chunks
        splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split(text)

        # Set API key for embedding
        os.environ["OPENAI_API_KEY"] = api_key

        # Embed chunks
        embedding_model = EmbeddingModel()
        vectordb = VectorDatabase(embedding_model)
        vectordb = await vectordb.abuild_from_list(chunks)

        # Store in session
        session_id = str(uuid.uuid4())
        pdf_sessions[session_id] = {"vectordb": vectordb, "chunks": chunks}

        return {"session_id": session_id}
    except Exception as e:
        import traceback; traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

class PDFChatRequest(BaseModel):
    session_id: str
    user_message: str
    model: Optional[str] = "gpt-4o-mini"
    api_key: str
    k: Optional[int] = 4  # Number of chunks to retrieve

@app.post("/api/chat_pdf")
async def chat_pdf(request: PDFChatRequest):
    """
    Accepts a user query and session ID, performs RAG, and returns a response.
    """
    try:
        session = pdf_sessions.get(request.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        vectordb = session["vectordb"]
        chunks = session["chunks"]

        # Retrieve top-k relevant chunks
        results = vectordb.search_by_text(request.user_message, k=request.k, return_as_text=False)
        context = "\n---\n".join([chunks[chunks.index(r[0])] if r[0] in chunks else r[0] for r in results])

        # Compose prompt for RAG
        prompt = f"You are an AI assistant. Use the following context from a PDF to answer the user's question.\n\nContext:\n{context}\n\nQuestion: {request.user_message}\n\nAnswer:"

        # Use ChatOpenAI to generate answer
        chat = ChatOpenAI(model_name=request.model)
        response = chat.run([
            {"role": "system", "content": "You are a helpful assistant for answering questions about uploaded PDFs."},
            {"role": "user", "content": prompt}
        ], text_only=True)

        return {"response": response}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

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
                messages=[
                    {"role": "developer", "content": request.developer_message},
                    {"role": "user", "content": request.user_message}
                ],
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
