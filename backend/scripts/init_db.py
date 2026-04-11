from app.storage.structured_store import engine, metadata

def init_db():
    metadata.create_all(engine)
    print("Tables created successfully")

if __name__ == "__main__":
    init_db()