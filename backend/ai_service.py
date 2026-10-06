"""
ai_service.py

Isolated AI integration layer for Smart AI Interview Assistance. Every
AI-powered feature goes through this file, so the AI provider can be
swapped later without touching route code.

If AI_API_KEY is not set, every function below falls back to
predefined/rule-based logic (FALLBACK MODE) so the whole app keeps working.
Callers get an `is_demo` flag back so the frontend can clearly label
demo/fallback results instead of claiming a real AI evaluation happened.
"""
import os
import json
import re
import requests
from dotenv import load_dotenv

load_dotenv()

AI_API_KEY = os.getenv("AI_API_KEY", "").strip()
AI_MODEL = os.getenv("AI_MODEL", "claude-sonnet-4-6")
AI_API_URL = "https://api.anthropic.com/v1/messages"

FALLBACK_MODE = len(AI_API_KEY) == 0


def _call_ai(system_prompt: str, user_prompt: str, max_tokens: int = 1200):
    if FALLBACK_MODE:
        return None
    try:
        headers = {"x-api-key": AI_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
        payload = {"model": AI_MODEL, "max_tokens": max_tokens, "system": system_prompt,
                   "messages": [{"role": "user", "content": user_prompt}]}
        resp = requests.post(AI_API_URL, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        return "\n".join(b["text"] for b in data.get("content", []) if b.get("type") == "text").strip()
    except Exception as e:
        print(f"[ai_service] AI API call failed, using fallback. Reason: {e}")
        return None


def _extract_json(text: str):
    if not text:
        return None
    text = re.sub(r"^```(json)?", "", text.strip()).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"(\[.*\]|\{.*\})", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(1))
            except Exception:
                return None
    return None


# =========================================================
# FALLBACK QUESTION BANK
# =========================================================
_FALLBACK_QUESTIONS = {
    "Technical": {
        "Software Developer": [
            "Explain the difference between object-oriented and procedural programming.",
            "What is the difference between an array and a linked list?",
            "How would you design a simple login system?",
            "Explain what an API is and how a frontend uses one.",
            "What is version control and why is Git useful in a team project?",
            "Explain the difference between synchronous and asynchronous code.",
        ],
        "Data Analyst": [
            "What is the difference between a primary key and a foreign key?",
            "Explain the difference between JOIN types in SQL.",
            "How would you handle missing data in a dataset?",
            "What is the difference between mean, median and mode, and when would you use each?",
            "Explain what data normalization means.",
        ],
        "Software Tester": [
            "What is the difference between manual and automated testing?",
            "Explain what a test case should contain.",
            "What is the difference between black-box and white-box testing?",
            "How would you prioritize which features to test first?",
            "What is regression testing?",
        ],
        "Web Developer": [
            "What is the difference between HTML, CSS and JavaScript?",
            "Explain how a browser renders a web page.",
            "What is responsive design and why does it matter?",
            "Explain the difference between GET and POST requests.",
            "What is the difference between frontend and backend development?",
        ],
        "Python Developer": [
            "Explain the difference between a list and a tuple in Python.",
            "What is a Python dictionary and when would you use one?",
            "Explain how exception handling works in Python.",
            "What is the difference between a function and a method in Python?",
            "How would you read data from a file in Python?",
        ],
        "_default": [
            "Tell me about a technical project you have worked on.",
            "What programming languages are you most comfortable with, and why?",
            "How do you approach learning a new technology?",
            "Explain a technical concept you understand well, as if to a beginner.",
            "What is your process for debugging a program that isn't working?",
        ],
    },
    "HR": [
        "Tell me about yourself.",
        "What are your greatest strengths and weaknesses?",
        "Why do you want to work for this company?",
        "Where do you see yourself in five years?",
        "Why should we hire you?",
    ],
    "Behavioral": [
        "Tell me about a time you disagreed with a teammate. How did you resolve it?",
        "Describe a situation where you had to meet a tight deadline.",
        "Tell me about a time you failed and what you learned from it.",
        "Give an example of when you showed leadership or teamwork.",
        "Describe how you handled receiving critical feedback.",
    ],
    "Coding": [
        "How would you reverse a string without using a built-in reverse function?",
        "How would you check if a number is prime?",
        "Explain the approach to find the largest number in a list.",
        "How would you check if a string is a palindrome?",
        "How would you find the sum of all elements in an array?",
    ],
}

_RESUME_BASED_FALLBACK = [
    "Walk me through a project mentioned on your resume.",
    "What technologies did you use in your most recent project and why?",
    "Describe a technical challenge you faced in one of your listed projects.",
    "How did you apply the skills listed on your resume in a real scenario?",
    "Which of your listed skills are you most confident in, and why?",
]


def generate_interview_questions(mode: str, job_role: str, experience_level: str,
                                  interview_type: str, num_questions: int,
                                  resume_context: str = None):
    """Returns (questions: list[str], is_demo: bool)."""
    if not FALLBACK_MODE:
        system_prompt = (
            "You are an expert technical interviewer. Generate interview questions as a "
            "JSON array of plain strings only, with no extra commentary."
        )
        user_prompt = (
            f"Generate exactly {num_questions} interview questions for a {job_role} role "
            f"({experience_level} experience level), interview type: {interview_type}. "
        )
        if resume_context:
            user_prompt += f"Base some questions on this candidate resume summary: {resume_context}. "
        user_prompt += "Respond with ONLY a JSON array of question strings."
        result = _call_ai(system_prompt, user_prompt)
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, list) and parsed:
            return [str(q) for q in parsed[:num_questions]], False

    # ---- Fallback ----
    if mode == "resume_based":
        pool = list(_RESUME_BASED_FALLBACK)
    elif interview_type == "Technical":
        pool = list(_FALLBACK_QUESTIONS["Technical"].get(job_role, _FALLBACK_QUESTIONS["Technical"]["_default"]))
    else:
        pool = list(_FALLBACK_QUESTIONS.get(interview_type, _FALLBACK_QUESTIONS["HR"]))

    if len(pool) < num_questions:
        pool = pool * ((num_questions // max(len(pool), 1)) + 1)
    return pool[:num_questions], True


def evaluate_answer(question: str, answer: str, job_role: str, skipped: bool = False):
    """Returns (dict with score/technical/communication/problem_solving/feedback, is_demo: bool)."""
    if skipped or not (answer or "").strip():
        return {
            "score": 0, "technical_score": 0, "communication_score": 0, "problem_solving_score": 0,
            "feedback": "No answer was provided for this question.",
        }, True

    if not FALLBACK_MODE:
        system_prompt = (
            "You are an expert interview evaluator. Score the candidate's answer on technical "
            "knowledge, communication and problem solving (each 0-100), plus an overall score "
            "(0-100). Respond with ONLY valid JSON: "
            '{"score": 0, "technical_score": 0, "communication_score": 0, "problem_solving_score": 0, "feedback": "..."}'
        )
        user_prompt = f"Job role: {job_role}\nQuestion: {question}\nCandidate answer: {answer}\n\nEvaluate this answer."
        result = _call_ai(system_prompt, user_prompt)
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, dict) and "score" in parsed:
            for k in ["score", "technical_score", "communication_score", "problem_solving_score"]:
                parsed[k] = max(0, min(100, float(parsed.get(k, parsed.get("score", 0)))))
            parsed.setdefault("feedback", "")
            return parsed, False

    return _rule_based_evaluation(question, answer), True


def _rule_based_evaluation(question: str, answer: str):
    answer = (answer or "").strip()
    word_count = len(answer.split())
    score = 40
    notes = []

    if word_count >= 15:
        score += 15
        notes.append("good level of detail")
    else:
        notes.append("could use more detail")

    if any(k in answer.lower() for k in ["example", "for instance", "such as", "e.g."]):
        score += 15
        notes.append("includes a concrete example")
    else:
        notes.append("try adding a real example")

    question_words = set(w.lower().strip(".,?") for w in question.split())
    answer_words = set(w.lower().strip(".,?") for w in answer.split())
    if question_words & answer_words:
        score += 10
        notes.append("relevant to the question")

    if word_count > 5:
        score += 10

    score = max(10, min(90, score))

    def near(base, delta):
        return max(0, min(100, base + delta))

    return {
        "score": score,
        "technical_score": near(score, -5),
        "communication_score": near(score, 5),
        "problem_solving_score": near(score, 0),
        "feedback": f"Demo evaluation (rule-based): {', '.join(notes)}.",
    }


def generate_feedback(score_summary: dict):
    """Returns (dict with strengths/improvements/recommended_practice lists, is_demo: bool)."""
    if not FALLBACK_MODE:
        system_prompt = (
            "You are an interview coach. Summarize overall interview performance. Respond with "
            'ONLY valid JSON: {"strengths": ["..."], "improvements": ["..."], "recommended_practice": ["..."]}'
        )
        result = _call_ai(system_prompt, f"Score summary: {json.dumps(score_summary)}")
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, dict):
            parsed.setdefault("strengths", [])
            parsed.setdefault("improvements", [])
            parsed.setdefault("recommended_practice", [])
            return parsed, False

    overall = score_summary.get("overall_score", 0) or 0
    strengths, improvements, recommended = [], [], []
    if overall >= 75:
        strengths.append("Strong overall performance across most questions.")
    elif overall >= 50:
        strengths.append("Solid foundation with room to grow.")
    else:
        improvements.append("Overall performance needs improvement - keep practicing.")

    if (score_summary.get("technical_score", 0) or 0) < 60:
        improvements.append("Technical depth could be improved.")
        recommended.append("Review core concepts for your target role and practice explaining them out loud.")
    if (score_summary.get("communication_score", 0) or 0) < 60:
        improvements.append("Communication clarity could be improved.")
        recommended.append("Practice structuring answers using a clear beginning, middle and end.")
    if not recommended:
        recommended.append("Keep practicing regularly with mock interviews and MCQs.")
    if not strengths:
        strengths.append("Willingness to attempt every question.")

    return {"strengths": strengths, "improvements": improvements, "recommended_practice": recommended}, True


def analyze_resume(resume_text: str):
    """Returns (dict of extracted fields + strength_score + doing_well/improve, is_demo: bool)."""
    if not FALLBACK_MODE:
        system_prompt = (
            "You extract structured information from resumes and rate resume strength (0-100). "
            "Respond with ONLY valid JSON: "
            '{"skills": "...", "education": "...", "projects": "...", "experience": "...", '
            '"certifications": "...", "keywords": "...", "formatting_notes": "...", '
            '"strength_score": 0, "doing_well": ["..."], "improve": ["..."]}'
        )
        result = _call_ai(system_prompt, f"Resume text:\n{resume_text[:6000]}")
        parsed = _extract_json(result) if result else None
        if isinstance(parsed, dict):
            for k in ["skills", "education", "projects", "experience", "certifications", "keywords", "formatting_notes"]:
                parsed.setdefault(k, "Not clearly detected.")
            parsed.setdefault("strength_score", 50)
            parsed.setdefault("doing_well", [])
            parsed.setdefault("improve", [])
            return parsed, False

    return _rule_based_resume_analysis(resume_text), True


def _rule_based_resume_analysis(resume_text: str):
    text_lower = resume_text.lower()
    tech_keywords = ["python", "java", "javascript", "react", "flask", "django", "fastapi",
                      "sql", "mongodb", "html", "css", "aws", "docker", "git", "c++", "node",
                      "linux", "kubernetes", "machine learning", "data structures"]
    found_tech = [t for t in tech_keywords if t in text_lower]

    education_match = re.findall(r"(b\.?tech|bachelor|master|m\.?tech|b\.?sc|m\.?sc|degree|university|college)[^\n]{0,60}", text_lower)
    experience_match = re.findall(r"(intern|experience|worked at|developer|engineer)[^\n]{0,60}", text_lower)
    project_match = re.findall(r"(project[^\n]{0,80})", text_lower)
    cert_match = re.findall(r"(certificat\w*[^\n]{0,80}|certified[^\n]{0,80})", text_lower)

    word_count = len(resume_text.split())
    score = 40
    doing_well, improve = [], []

    if found_tech:
        score += 20
        doing_well.append("Clear technical skills are mentioned.")
    else:
        improve.append("Add more specific technical skills and tools.")

    if project_match:
        score += 15
        doing_well.append("Projects section is present.")
    else:
        improve.append("Add a projects section describing what you built.")

    if education_match:
        score += 10
        doing_well.append("Education section is clearly mentioned.")
    else:
        improve.append("Make sure your education details are clearly listed.")

    if cert_match:
        score += 5
        doing_well.append("Certifications are mentioned.")
    else:
        improve.append("Consider adding relevant certifications, if any.")

    if word_count < 100:
        improve.append("Resume looks quite short - add more detail about your experience.")
    else:
        score += 10

    score = max(10, min(95, score))
    if not doing_well:
        doing_well.append("Resume was uploaded and text was extracted successfully.")

    return {
        "skills": ", ".join(found_tech) if found_tech else "Not clearly detected.",
        "education": "; ".join(set(education_match[:3])) if education_match else "Not clearly detected.",
        "projects": "; ".join(set(project_match[:3])) if project_match else "Not clearly detected.",
        "experience": "; ".join(set(experience_match[:3])) if experience_match else "Not clearly detected.",
        "certifications": "; ".join(set(cert_match[:3])) if cert_match else "Not clearly detected.",
        "keywords": ", ".join(found_tech) if found_tech else "Not clearly detected.",
        "formatting_notes": f"Resume contains approximately {word_count} words.",
        "strength_score": score,
        "doing_well": doing_well,
        "improve": improve,
    }


# =========================================================
# AI ASSISTANT ("Ask AI" floating panel)
# =========================================================
_ASSISTANT_FALLBACK_RULES = [
    (["java"], "For Java interviews, focus on OOP concepts (inheritance, polymorphism), collections (ArrayList vs HashSet), and exception handling. Try the Java category in Practice Interview or Question Bank to test yourself."),
    (["sql", "database", "dbms"], "For SQL/DBMS, review JOINs, normalization, indexes, and ACID properties. Practice the SQL and DBMS categories in Question Bank, and try writing a few queries by hand."),
    (["oop", "object oriented", "object-oriented"], "OOP has four pillars: Encapsulation (bundling data+methods), Abstraction (hiding complexity), Inheritance (reusing behavior from a parent class), and Polymorphism (same interface, different behavior). Try explaining each with a one-line example out loud."),
    (["resume"], "To improve your resume: list specific technologies you've used, add measurable outcomes to projects (e.g. 'reduced load time by 30%'), and make sure your skills section matches the job description's keywords. Try the Resume Analyzer for a detailed breakdown."),
    (["low score", "why did i", "bad score", "score low"], "A low score is usually due to short answers, missing examples, or answers that don't directly address the question. Check the 'Areas to Improve' section on your latest result page, and try adding a concrete example next time."),
    (["coding", "code", "practice problem"], "For coding practice, start with the Easy problems (Find Largest Number, Check Even/Odd, Reverse a String) before moving to Medium ones. Explain your approach out loud before writing code - interviewers value that."),
    (["python"], "For Python interviews, be ready to explain lists vs tuples, dictionaries, list comprehensions, and exception handling. Practice the Python category in Question Bank."),
    (["javascript", "js"], "For JavaScript, review closures, promises/async-await, and the difference between let/var/const. The JavaScript category in Question Bank covers all of these."),
    (["mock interview", "interview tips", "prepare"], "Before a mock interview: pick a job role close to what you're targeting, choose Technical or Behavioral based on what you want to practice, and try to speak your answers out loud rather than just typing quickly."),
]

_ASSISTANT_DEFAULT_REPLY = (
    "I can help with interview prep, specific topics (Python, Java, SQL, OOP...), resume feedback, "
    "or explaining your last score. Try asking something like \"Explain OOP\" or \"How can I improve my resume?\""
)


def ask_assistant(message: str, context: dict = None):
    """Returns (reply: str, is_demo: bool). context can include recent user stats
    (weak_topics, latest_score, etc.) to make fallback replies more relevant."""
    context = context or {}

    if not FALLBACK_MODE:
        system_prompt = (
            "You are a friendly, encouraging AI interview coach inside an interview-prep app called "
            "Smart AI Interview Assistance. Answer the user's question in 2-4 short sentences, giving "
            "concrete, actionable advice. Keep it simple enough for a college student."
        )
        user_prompt = f"User context: {json.dumps(context)}\nUser question: {message}"
        result = _call_ai(system_prompt, user_prompt, max_tokens=400)
        if result:
            return result.strip(), False

    lower = message.lower()
    for keywords, reply in _ASSISTANT_FALLBACK_RULES:
        if any(k in lower for k in keywords):
            return reply, True

    weak_topics = context.get("weak_topics") or []
    if weak_topics:
        return (
            f"Based on your recent quiz results, your weaker topics are: {', '.join(weak_topics)}. "
            f"I'd recommend practicing those categories in Question Bank or Practice Interview next."
        ), True

    return _ASSISTANT_DEFAULT_REPLY, True
