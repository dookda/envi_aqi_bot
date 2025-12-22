"""add r2 columns to model_training_log

Revision ID: 002
Revises: 001
Create Date: 2025-12-22 15:20:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # Add R² (coefficient of determination) columns for model evaluation
    op.add_column('model_training_log', sa.Column('train_r2', sa.Float(), nullable=True))
    op.add_column('model_training_log', sa.Column('val_r2', sa.Float(), nullable=True))


def downgrade():
    # Remove R² columns
    op.drop_column('model_training_log', 'val_r2')
    op.drop_column('model_training_log', 'train_r2')
