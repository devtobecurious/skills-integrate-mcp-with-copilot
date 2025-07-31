"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
import os
import json
import secrets
from pathlib import Path
from typing import Optional

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory session storage (in production, use Redis or database)
active_sessions = {}

# Load teacher credentials
def load_teachers():
    teachers_file = Path(__file__).parent / "teachers.json"
    try:
        with open(teachers_file, 'r') as f:
            return json.load(f)['teachers']
    except FileNotFoundError:
        return {}

teachers = load_teachers()

# Models
class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    teacher_name: Optional[str] = None

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


def verify_admin_token(authorization: Optional[str] = Header(None)):
    """Verify if the request contains a valid admin token"""
    if not authorization:
        return None
    
    if not authorization.startswith("Bearer "):
        return None
    
    token = authorization.split(" ")[1]
    return active_sessions.get(token)


def require_admin(authorization: Optional[str] = Header(None)):
    """Dependency that requires valid admin authentication"""
    teacher_info = verify_admin_token(authorization)
    if not teacher_info:
        raise HTTPException(
            status_code=401, 
            detail="Authentication required. Only teachers can perform this action."
        )
    return teacher_info


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/auth/login", response_model=LoginResponse)
def login(login_request: LoginRequest):
    """Authenticate a teacher and return a session token"""
    email = login_request.email
    password = login_request.password
    
    # Check if teacher exists and password matches
    if email not in teachers:
        return LoginResponse(
            success=False,
            message="Invalid email or password"
        )
    
    if teachers[email]["password"] != password:
        return LoginResponse(
            success=False,
            message="Invalid email or password"
        )
    
    # Generate session token
    token = secrets.token_urlsafe(32)
    active_sessions[token] = {
        "email": email,
        "name": teachers[email]["name"]
    }
    
    return LoginResponse(
        success=True,
        message="Login successful",
        token=token,
        teacher_name=teachers[email]["name"]
    )


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    """Logout a teacher and invalidate their session token"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        if token in active_sessions:
            del active_sessions[token]
    
    return {"message": "Logged out successfully"}


@app.get("/auth/status")
def auth_status(authorization: Optional[str] = Header(None)):
    """Check if current session is authenticated"""
    teacher_info = verify_admin_token(authorization)
    
    if teacher_info:
        return {
            "authenticated": True,
            "teacher_name": teacher_info["name"],
            "email": teacher_info["email"]
        }
    
    return {"authenticated": False}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str, 
    email: str, 
    teacher_info: dict = Depends(require_admin)
):
    """Sign up a student for an activity (admin only)"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str, 
    email: str, 
    teacher_info: dict = Depends(require_admin)
):
    """Unregister a student from an activity (admin only)"""
    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}