import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_email_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def send_email(to_email: str, subject: str, body: str) -> None:
    if not is_email_configured():
        logger.info("Email skipped because SMTP is not configured. recipient=%s subject=%s", to_email, subject)
        return

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()

            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

            smtp.send_message(message)
    except Exception:
        logger.exception("Email delivery failed. recipient=%s subject=%s", to_email, subject)


def send_registration_email(to_email: str, username: str) -> None:
    send_email(
        to_email,
        "Hackathon registration confirmed",
        (
            f"Hi {username},\n\n"
            "Your hackathon registration is confirmed.\n\n"
            f"Open your dashboard: {settings.APP_PUBLIC_URL}/hub\n\n"
            "Good luck,\n"
            "HackCore Team"
        ),
    )


def send_privileged_user_created_email(to_email: str, username: str, role: str, temporary_password: str) -> None:
    dashboard_path = "/admin" if role == "admin" else "/judge"

    send_email(
        to_email,
        f"HackCore {role} account created",
        (
            f"Hi {username},\n\n"
            f"A HackCore {role} account has been created for you.\n\n"
            f"Username: {username}\n"
            f"Temporary password: {temporary_password}\n\n"
            f"Sign in here: {settings.APP_PUBLIC_URL}/auth\n"
            f"Dashboard: {settings.APP_PUBLIC_URL}{dashboard_path}\n\n"
            "Please keep this password private.\n\n"
            "HackCore Team"
        ),
    )


def send_round1_qualified_email(to_email: str, username: str, team_name: str, team_average: float) -> None:
    send_email(
        to_email,
        "Your team qualified for Round 2",
        (
            f"Hi {username},\n\n"
            f"Congratulations. {team_name} qualified for Round 2 with a team average of {team_average}%.\n\n"
            f"Open the hackathon hub: {settings.APP_PUBLIC_URL}/hub\n\n"
            "HackCore Team"
        ),
    )


def send_project_submitted_email(to_email: str, username: str, team_name: str, project_title: str) -> None:
    send_email(
        to_email,
        "Project submission confirmed",
        (
            f"Hi {username},\n\n"
            f"Your team {team_name} submitted the project \"{project_title}\" successfully.\n\n"
            f"Track the hackathon from your dashboard: {settings.APP_PUBLIC_URL}/hub\n\n"
            "HackCore Team"
        ),
    )


def send_project_judged_email(to_email: str, username: str, team_name: str, project_title: str, total_score: float) -> None:
    send_email(
        to_email,
        "Project judging complete",
        (
            f"Hi {username},\n\n"
            f"All judges have completed evaluation for {team_name}'s project \"{project_title}\".\n"
            f"Final judging score: {total_score}.\n\n"
            f"View standings: {settings.APP_PUBLIC_URL}/leaderboard\n\n"
            "HackCore Team"
        ),
    )
