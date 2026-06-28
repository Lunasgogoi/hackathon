import pytest

from app.api.leaderboard import fetch_top_teams


pytestmark = pytest.mark.asyncio


async def test_no_judges_means_empty_leaderboard(db_session):
    leaderboard = await fetch_top_teams(db_session)

    assert leaderboard == []


async def test_promoted_fully_judged_team_appears(
    db_session,
    create_user,
    create_team,
    create_project,
    create_evaluation,
):
    captain = await create_user(username="leader-captain")
    team = await create_team(name="Leaderboard Team", captain=captain, promoted=True)
    project = await create_project(team=team)
    judge = await create_user(username="leader-judge", role="judge")
    await create_evaluation(project=project, judge=judge, total_score=25)

    leaderboard = await fetch_top_teams(db_session)

    assert len(leaderboard) == 1
    assert leaderboard[0]["team"] == "Leaderboard Team"
    assert leaderboard[0]["score"] == 25
    assert leaderboard[0]["evaluations_count"] == 1
    assert leaderboard[0]["required_evaluations"] == 1


async def test_partially_judged_team_does_not_appear(
    db_session,
    create_user,
    create_team,
    create_project,
    create_evaluation,
):
    captain = await create_user(username="partial-captain")
    team = await create_team(name="Partial Team", captain=captain, promoted=True)
    project = await create_project(team=team)
    first_judge = await create_user(username="first-judge", role="judge")
    await create_user(username="second-judge", role="judge")
    await create_evaluation(project=project, judge=first_judge, total_score=20)

    leaderboard = await fetch_top_teams(db_session)

    assert leaderboard == []


async def test_leaderboard_orders_by_total_score_descending(
    db_session,
    create_user,
    create_team,
    create_project,
    create_evaluation,
):
    judge = await create_user(username="ordering-judge", role="judge")
    low_captain = await create_user(username="low-captain")
    high_captain = await create_user(username="high-captain")
    low_team = await create_team(name="Low Team", captain=low_captain, promoted=True)
    high_team = await create_team(name="High Team", captain=high_captain, promoted=True)
    low_project = await create_project(team=low_team, title="Low Project")
    high_project = await create_project(team=high_team, title="High Project")
    await create_evaluation(project=low_project, judge=judge, total_score=15)
    await create_evaluation(project=high_project, judge=judge, total_score=29)

    leaderboard = await fetch_top_teams(db_session)

    assert [entry["team"] for entry in leaderboard] == ["High Team", "Low Team"]
    assert [entry["rank"] for entry in leaderboard] == [1, 2]
