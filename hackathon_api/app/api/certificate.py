from datetime import datetime
from io import BytesIO
import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.api.leaderboard import fetch_top_teams
from app.models.system import SystemState
from app.models.team import Team
from app.models.user import RoleEnum, User

router = APIRouter(prefix="/certificates", tags=["Certificates"])


def safe_filename(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_-]+", "-", value.strip())
    return normalized.strip("-") or "team"


def build_certificate_pdf(
    *,
    team_name: str,
    rank: int,
    score: float,
    members: list[str],
    verification_id: str,
) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.pdfgen import canvas
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF generation is not configured. Install reportlab on the backend.",
        ) from exc

    buffer = BytesIO()
    page_width, page_height = landscape(A4)
    pdf = canvas.Canvas(buffer, pagesize=(page_width, page_height))

    margin = 42
    inner_margin = 58

    pdf.setFillColor(colors.HexColor("#f8fafc"))
    pdf.rect(0, 0, page_width, page_height, fill=1, stroke=0)

    pdf.setStrokeColor(colors.HexColor("#0f172a"))
    pdf.setLineWidth(2)
    pdf.rect(margin, margin, page_width - (margin * 2), page_height - (margin * 2), fill=0, stroke=1)

    pdf.setStrokeColor(colors.HexColor("#2563eb"))
    pdf.setLineWidth(5)
    pdf.rect(margin + 10, margin + 10, page_width - ((margin + 10) * 2), page_height - ((margin + 10) * 2), fill=0, stroke=1)

    pdf.setFillColor(colors.HexColor("#1d4ed8"))
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawCentredString(page_width / 2, page_height - 92, "HACKCORE GRAND FINALE")

    pdf.setFillColor(colors.HexColor("#0f172a"))
    pdf.setFont("Helvetica-Bold", 34)
    pdf.drawCentredString(page_width / 2, page_height - 142, "Certificate of Achievement")

    pdf.setFillColor(colors.HexColor("#475569"))
    pdf.setFont("Helvetica", 13)
    pdf.drawCentredString(page_width / 2, page_height - 184, "Presented to")

    pdf.setFillColor(colors.HexColor("#111827"))
    pdf.setFont("Helvetica-Bold", 30)
    pdf.drawCentredString(page_width / 2, page_height - 226, team_name[:48])

    pdf.setFillColor(colors.HexColor("#475569"))
    pdf.setFont("Helvetica", 13)
    pdf.drawCentredString(page_width / 2, page_height - 266, "for finishing in the Top 10 of the hackathon grand finale")

    pdf.setFillColor(colors.HexColor("#0f172a"))
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawCentredString(page_width / 2, page_height - 308, f"Rank #{rank}  |  Final Score {score:.1f}")

    members_text = ", ".join(members) if members else "Registered team members"
    pdf.setFillColor(colors.HexColor("#334155"))
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(inner_margin + 12, 148, "Team Members")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(inner_margin + 12, 128, members_text[:105])

    issued_on = datetime.utcnow().strftime("%B %d, %Y")
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(inner_margin + 12, 88, "Issued On")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(inner_margin + 12, 68, issued_on)

    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(page_width - inner_margin - 12, 88, "Verification ID")
    pdf.setFont("Helvetica", 11)
    pdf.drawRightString(page_width - inner_margin - 12, 68, verification_id)

    pdf.setStrokeColor(colors.HexColor("#94a3b8"))
    pdf.setLineWidth(1)
    pdf.line(page_width - 270, 148, page_width - inner_margin - 12, 148)
    pdf.setFillColor(colors.HexColor("#334155"))
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(page_width - inner_margin - 12, 128, "Organizer Signature")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


@router.get("/my-team")
async def download_my_team_certificate(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != RoleEnum.participant:
        raise HTTPException(status_code=403, detail="Only participants can download team certificates.")

    if not current_user.team_id:
        raise HTTPException(status_code=400, detail="You must be on a team to download a certificate.")

    finale_state = (await db.execute(
        select(SystemState).where(SystemState.phase_name == "finale")
    )).scalar_one_or_none()
    if not finale_state or finale_state.status != "completed":
        raise HTTPException(status_code=403, detail="Certificates are available after the finale is completed.")

    top_teams = await fetch_top_teams(db, limit=10)
    team_standing = next(
        (standing for standing in top_teams if standing["team_id"] == current_user.team_id),
        None,
    )
    if not team_standing:
        raise HTTPException(status_code=403, detail="Only Top 10 finalist teams can download certificates.")

    team = (await db.execute(select(Team).where(Team.id == current_user.team_id))).scalar_one()
    members = list((await db.execute(
        select(User.username).where(User.team_id == team.id, User.role == RoleEnum.participant).order_by(User.id)
    )).scalars().all())

    verification_id = f"HC-{team.id}-{team_standing['rank']}-{datetime.utcnow().strftime('%Y%m%d')}"
    pdf_bytes = build_certificate_pdf(
        team_name=team.name,
        rank=team_standing["rank"],
        score=float(team_standing["score"]),
        members=members,
        verification_id=verification_id,
    )

    filename = f"hackcore-certificate-{safe_filename(team.name)}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
