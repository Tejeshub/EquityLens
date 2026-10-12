from logging.config import fileConfig

from alembic import context

from core.db import Base, get_engine
import core.orm  # noqa: F401  (register models)
import storage.structured_store  # noqa: F401  (register legacy tables)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata


def run_migrations_online() -> None:
    connectable = get_engine()
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
