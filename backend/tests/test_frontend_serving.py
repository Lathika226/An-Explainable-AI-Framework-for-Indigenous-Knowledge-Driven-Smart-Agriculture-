import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_frontend_and_direct_navigation_are_served():
    home = client.get("/")
    deep_link = client.get("/direct-navigation-check")

    assert home.status_code == 200
    assert deep_link.status_code == 200
    assert '<div id="root"></div>' in home.text
    assert '<div id="root"></div>' in deep_link.text


def test_frontend_assets_are_served():
    dist_path = Path(__file__).parents[2] / "frontend" / "dist"
    assets = sorted((dist_path / "assets").glob("*.js"))

    assert assets, "The frontend production build must contain a JavaScript asset."
    response = client.get(f"/assets/{assets[0].name}")

    assert response.status_code == 200
    assert response.content


def test_api_docs_and_unknown_api_routes_are_preserved():
    docs = client.get("/docs")
    openapi = client.get("/openapi.json")
    health = client.get("/health")
    lan_info = client.get("/api/system/lan-info")
    unknown_api = client.get("/api/not-a-real-endpoint")

    assert docs.status_code == 200
    assert "swagger-ui" in docs.text
    assert openapi.status_code == 200
    assert health.json()["service"] == "ai-agriculture-api"
    assert lan_info.json()["frontend_port"] == 8000
    assert unknown_api.status_code == 404
    assert unknown_api.json()["detail"] == "API route not found"
