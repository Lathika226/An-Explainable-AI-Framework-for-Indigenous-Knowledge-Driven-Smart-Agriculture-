from sqlalchemy import or_
from app.models import IndigenousKnowledge

class KnowledgeService:
    def search(self, db, query: str, state=None, crop=None, stage=None):
        q = db.query(IndigenousKnowledge).filter(
            IndigenousKnowledge.validation_status == "VERIFIED",
            IndigenousKnowledge.evidence.isnot(None),
            IndigenousKnowledge.source.isnot(None),
            IndigenousKnowledge.source_url.ilike("https://%"),
        )

        if state:
            q = q.filter(IndigenousKnowledge.state.ilike(f"%{state}%"))
        if crop:
            q = q.filter(IndigenousKnowledge.crop.ilike(f"%{crop}%"))
        if stage:
            q = q.filter(
                or_(
                    IndigenousKnowledge.crop_stage.ilike(f"%{stage}%"),
                    IndigenousKnowledge.crop_stage.is_(None),
                )
            )

        # Starter lexical retrieval. Replace/augment with pgvector embeddings
        # when the knowledge corpus is populated.
        terms = [x.strip() for x in query.lower().split() if len(x.strip()) > 2][:6]
        for term in terms:
            q = q.filter(
                or_(
                    IndigenousKnowledge.title.ilike(f"%{term}%"),
                    IndigenousKnowledge.problem.ilike(f"%{term}%"),
                    IndigenousKnowledge.practice.ilike(f"%{term}%"),
                )
            )

        return q.limit(10).all()
