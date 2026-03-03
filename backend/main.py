from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
import numpy as np
import pandas as pd
import json
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Mock Data
np.random.seed(42)
N = 2000
companies = ["Google", "Microsoft", "Amazon", "Stripe", "Shopify", "Netflix", "Uber", "Airbnb", "Salesforce", "Oracle"]
roles = ["Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "DevOps Engineer", "Platform Engineer"]

df = pd.DataFrame({
    "id": range(1, N + 1),
    "company": np.random.choice(companies, N),
    "role": np.random.choice(roles, N),
    "DemosGenerated": np.random.randint(0, 500, N),
    "daysInactive": np.random.randint(0, 90, N),
})

df["userType"] = pd.cut(
    df["DemosGenerated"],
    bins=[-1, 20, 100, 300, 500],
    labels=["Inactive User", "Casual User", "Active User", "Power User"]
)

#Embeddings Cache 
user_embeddings = None
user_texts = []

def get_user_texts():
    texts = []
    for _, row in df.iterrows():
        texts.append(
            f"User from {row['company']}, role: {row['role']}, "
            f"Demos generated: {row['DemosGenerated']}, "
            f"days inactive: {row['daysInactive']}, "
            f"type: {row['userType']}"
        )
    return texts

def build_embeddings():
    global user_embeddings, user_texts
    if user_embeddings is not None:
        return
    print("Building embeddings...")
    user_texts = get_user_texts()
    # Embed in batches of 100
    all_embeddings = []
    for i in range(0, len(user_texts), 100):
        batch = user_texts[i:i+100]
        response = client.embeddings.create(
            input=batch,
            model="text-embedding-3-small"
        )
        all_embeddings.extend([e.embedding for e in response.data])
    user_embeddings = np.array(all_embeddings)
    print("Embeddings built!")

def semantic_search(query: str, top_k: int = 10):
    build_embeddings()
    response = client.embeddings.create(
        input=[query],
        model="text-embedding-3-small"
    )
    query_embedding = np.array(response.data[0].embedding)
    similarities = np.dot(user_embeddings, query_embedding) / (
        np.linalg.norm(user_embeddings, axis=1) * np.linalg.norm(query_embedding)
    )
    top_indices = np.argsort(similarities)[-top_k:][::-1]
    return [user_texts[i] for i in top_indices]

#Anomaly Detection
def detect_anomalies():
    anomalies = []
    
    #High inactivity
    inactive = df[df["daysInactive"] > 75]
    if len(inactive) > 0:
        anomalies.append(f"⚠️ {len(inactive)} users have been inactive for over 75 days — churn risk.")

    #Low usage power users
    low_power = df[(df["userType"] == "Power User") & (df["daysInactive"] > 30)]
    if len(low_power) > 0:
        anomalies.append(f"📉 {len(low_power)} Power Users haven't logged in for 30+ days — at risk of downgrading.")

    #Company with no active users
    company_stats = df.groupby("company")["DemosGenerated"].mean()
    low_companies = company_stats[company_stats < 50].index.tolist()
    if low_companies:
        anomalies.append(f"🏢 Low engagement from: {', '.join(low_companies)} — average under 50 Demos.")

    #Sudden drop detection
    mean = df["DemosGenerated"].mean()
    std = df["DemosGenerated"].std()
    outliers = df[df["DemosGenerated"] > mean + 2 * std]
    if len(outliers) > 0:
        anomalies.append(f"🚀 {len(outliers)} users are generating Demos 2x above average — potential champions.")

    return anomalies

#Routes
class ChatRequest(BaseModel):
    question: str
    history: list = []

@app.get("/anomalies")
def get_anomalies():
    return {"anomalies": detect_anomalies()}

@app.post("/chat")
def chat(req: ChatRequest):
    # Step 1: Ask GPT to generate pandas code
    code_prompt = f"""
You are a pandas code generator. The user has a dataframe called `df` with these columns:
- id (int)
- company (str): one of Google, Microsoft, Amazon, Stripe, Shopify, Netflix, Uber, Airbnb, Salesforce, Oracle
- role (str): one of Backend Engineer, Frontend Engineer, Full Stack Engineer, DevOps Engineer, Platform Engineer
- DemosGenerated (int): 0-500
- daysInactive (int): 0-90
- userType (str): exactly one of "Power User", "Active User", "Casual User", "Inactive User"

Write a single Python pandas expression to answer this question: "{req.question}"

Rules:
- Return ONLY the pandas code, nothing else
- No imports, no print statements
- Must be a single expression that returns a value
- Use only these safe operations: groupby, filter, sort_values, head, value_counts, mean, sum, count, unique, nunique, describe
- Store result in a variable called `result`
- For userType always use exact strings: "Power User", "Active User", "Casual User", "Inactive User"
- For company always use exact strings: "Google", "Microsoft", "Amazon", "Stripe", "Shopify", "Netflix", "Uber", "Airbnb", "Salesforce", "Oracle"

Example: result = df[df['userType'] == 'Power User'][['company', 'role', 'DemosGenerated', 'daysInactive']].head(10)
"""

    code_response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": code_prompt}],
        max_tokens=200
    )
    
    generated_code = code_response.choices[0].message.content.strip()
    # Cleaning up code blocks if GPT adds them
    generated_code = generated_code.replace("```python", "").replace("```", "").strip()

    # Step 2: Execute the pandas code safely
    try:
        local_vars = {"df": df, "pd": pd, "np": np}
        exec(generated_code, {"__builtins__": {}}, local_vars)
        query_result = local_vars.get("result", "No result")
        # Convert to string for GPT
        if hasattr(query_result, 'to_string'):
            result_str = query_result.to_string()
        else:
            result_str = str(query_result)
    except Exception as e:
        # Fallback to semantic search if code fails
        relevant_users = semantic_search(req.question)
        result_str = "\n".join(relevant_users)

    # Step 3: Ask GPT to explain the result in plain English
    explanation_prompt = f"""
You are an expert product analyst for Demo, a developer tool that generates Demos — visual representations of how code behaves at runtime.

STRICT RULES:
- Only reference data explicitly provided below — never invent users, companies, or numbers
- Always say "Demos" not any other word
- Never mention roles or companies that aren't in the data below
- Be extremely concise — 3-5 lines maximum
- No bullet points, no headers, no "Actionable Insights" sections
- Just answer the question directly and state one key recommendation
- No fluff, no lengthy explanations

The user asked: "{req.question}"

Here is the EXACT data from the database — base your entire answer on this only:
{result_str}
"""

    final_response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": explanation_prompt},
            *req.history,
            {"role": "user", "content": req.question}
        ],
        max_tokens=400
    )

    return {"answer": final_response.choices[0].message.content}

@app.get("/stats")
def get_stats():
    company_stats = df.groupby("company").agg(
        users=("id", "count"),
        totalDemos=("DemosGenerated", "sum")
    ).reset_index().sort_values("totalDemos", ascending=False).to_dict(orient="records")

    return {
        "total": len(df),
        "powerUsers": int((df["userType"] == "Power User").sum()),
        "activeUsers": int((df["userType"] == "Active User").sum()),
        "casualUsers": int((df["userType"] == "Casual User").sum()),
        "inactiveUsers": int((df["userType"] == "Inactive User").sum()),
        "avgDemos": int(df["DemosGenerated"].mean()),
        "totalDemos": int(df["DemosGenerated"].sum()),
        "companyStats": company_stats,
        "monthlyGrowth": [
            {"month": m, "users": u} for m, u in zip(
                ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"],
                [600, 850, 1050, 1300, 1550, 1800, 2000]
            )
        ]
    }