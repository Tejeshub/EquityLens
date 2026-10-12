"""users.email_canonical: one account per canonical mailbox (plus-tag / gmail-dot variants collapse)

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from core.emailnorm import canonical_email  # noqa: E402

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_canonical", sa.String(320), nullable=True))
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, email FROM users")).fetchall()
    seen = {}
    for id_, email in rows:
        try:
            c = canonical_email(email.strip().lower())
        except Exception:
            c = email.strip().lower()
        if c in seen:  # pre-existing duplicates under the new rule: keep the first account's canonical form, make others unique & visible
            c = f"{c}#dup-{id_}"
        seen[c] = id_
        conn.execute(sa.text("UPDATE users SET email_canonical=:c WHERE id=:i"), {"c": c, "i": id_})
    op.alter_column("users", "email_canonical", nullable=False)
    op.create_index("uq_users_email_canonical", "users", ["email_canonical"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_users_email_canonical", table_name="users")
    op.drop_column("users", "email_canonical")
