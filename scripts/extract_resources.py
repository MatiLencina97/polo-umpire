#!/usr/bin/env python3
"""Extract non-playing-rule governing resources from the USPA Rulebook.

Creates public/data/resources-<year>.json with Constitution, By-Laws, Tournament
Conditions, NYTS, Alternative Format Arena, I/I, Equine Medications, Umpire Guide,
and USPA Policies. The UI indexes this file locally/offline alongside the playing rules.
"""
from __future__ import annotations
import hashlib, json, re, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "source" / "rulebook.pdf"
DATA_DIR = ROOT / "public" / "data"
MANIFEST = DATA_DIR / "manifest.json"
SIDE_LABELS = set("OUTDOORARENAUMPIRETOURNEMRTCPLWSBYI")

def pdf_text():
    cp=subprocess.run(["pdftotext","-raw",str(PDF),"-"],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    return cp.stdout.decode("utf-8",errors="ignore").replace("\r","")

def printed(page,fallback):
    vals=[int(x.strip()) for x in page.splitlines() if re.fullmatch(r"\d{1,3}",x.strip()) and 0<int(x.strip())<500]
    return vals[-1] if vals else fallback

def clean(page,year):
    out=[]
    header=re.compile(rf"^(?:UNITED STATES POLO ASSOCIATION®?\s+{year}|{year}\s+UNITED STATES POLO ASSOCIATION®?)$",re.I)
    for raw in page.splitlines():
        s=raw.strip()
        if not s: out.append(""); continue
        if header.match(s) or re.fullmatch(r"\d{1,3}",s): continue
        if len(s)==1 and s.upper() in SIDE_LABELS: continue
        out.append(s.replace("\u00ad",""))
    text="\n".join(out)
    text=re.sub(r"\n{3,}","\n\n",text)
    text=re.sub(r"([A-Za-z])-\n([a-z])",r"\1\2",text)
    return text.strip()

def find_year(pages):
    vals=re.findall(r"\b20\d{2}\b","\n".join(pages[:8]))
    return int(max(set(vals),key=vals.count))

def collect(pages,year,pstart,pend,start_hint=0):
    rows=[]
    for i in range(start_hint,len(pages)):
        pr=printed(pages[i],i+1)
        if pstart<=pr<=pend:
            rows.append({"pdfPage":i+1,"page":pr,"text":clean(pages[i],year)})
        elif rows and pr>pend:
            break
    return rows

def marker(rows):
    return "".join(f"\n<<<PAGE:{r['pdfPage']}:{r['page']}>>>\n{r['text']}\n" for r in rows)

def page_at(text,pos):
    last=(None,None)
    for m in re.finditer(r"<<<PAGE:(\d+):(\d+)>>>",text):
        if m.start()>pos: break
        last=(int(m.group(1)),int(m.group(2)))
    return last

def strip_markers(text):
    return re.sub(r"\n?<<<PAGE:\d+:\d+>>>\n?","\n",text).strip()

def slug(value):
    return re.sub(r"[^a-z0-9]+","-",value.lower().replace("®","")).strip("-")[:100]

def keywords(value):
    return sorted(set(re.findall(r"[a-z0-9]+",value.lower())))

def split_named(resource_id,text,specs):
    hits=[]
    for title,pattern in specs:
        m=re.search(pattern,text,re.I|re.M|re.S)
        if m: hits.append((m.start(),title))
    hits.sort()
    out=[]
    for i,(pos,title) in enumerate(hits):
        end=hits[i+1][0] if i+1<len(hits) else len(text)
        pdf1,p1=page_at(text,pos); pdf2,p2=page_at(text,max(pos,end-1))
        body=strip_markers(text[pos:end])
        if len(body)<20: continue
        out.append({"id":resource_id+"-"+slug(title),"ref":title,"title":title,"pageStart":p1,"pageEnd":p2,"pdfPageStart":pdf1,"pdfPageEnd":pdf2,"text":body,"keywords":keywords(title)})
    return out

def articles(resource_id,text,preamble=False):
    specs=[]
    if preamble: specs.append(("Preamble",r"^PREAMBLE$"))
    for m in re.finditer(r"^ARTICLE\s+([IVXLCDM]+)\s*\n([^\n]+)",text,re.I|re.M):
        title=f"Article {m.group(1).upper()} - {m.group(2).strip()}"
        specs.append((title,r"^ARTICLE\s+"+re.escape(m.group(1))+r"\s*\n"+re.escape(m.group(2).strip())))
    return split_named(resource_id,text,specs)

def page_sections(resource_id,rows,starts,end_page):
    out=[]
    starts=sorted(starts,key=lambda x:(x[1],x[2]))
    for i,(title,sp,order) in enumerate(starts):
        ep=starts[i+1][1]-1 if i+1<len(starts) else end_page
        if ep<sp: ep=sp
        chosen=[r for r in rows if sp<=r["page"]<=ep] or [r for r in rows if r["page"]==sp]
        if not chosen: continue
        out.append({"id":resource_id+"-"+slug(title),"ref":title,"title":title,"pageStart":sp,"pageEnd":ep,"pdfPageStart":chosen[0]["pdfPage"],"pdfPageEnd":chosen[-1]["pdfPage"],"text":"\n\n".join(r["text"] for r in chosen),"keywords":keywords(title)})
    return out

def main():
    if not PDF.exists(): raise SystemExit(f"PDF not found: {PDF}")
    raw=pdf_text(); pages=raw.split("\f"); year=find_year(pages)
    resources=[]
    def add(rid,title,short,pstart,pend,sections,aliases,extra):
        rows=collect(pages,year,pstart,pend)
        resources.append({"id":rid,"title":title,"shortTitle":short,"aliases":aliases,"keywords":sorted(set(keywords(title)+extra)),"pageStart":pstart,"pageEnd":pend,"pdfPageStart":rows[0]["pdfPage"],"pdfPageEnd":rows[-1]["pdfPage"],"sections":sections(rows,marker(rows))})

    add("constitution","Constitution of the United States Polo Association","Constitution",1,14,lambda rows,mt:articles("constitution",mt),["Constitution","Constitution / By-Laws"],["membership","registered","affiliate","player"])
    add("bylaws","By-Laws of the United States Polo Association","By-Laws",15,40,lambda rows,mt:articles("bylaws",mt,True),["By-Laws","Constitution / By-Laws"],["membership","registered","affiliate","player"])

    tc=[("Section I - Definitions",r"^I\.\s+DEFINITIONS"),("Section II - USPA Events - "+str(year),rf"^II\.\s+USPA EVENTS\s*-\s*{year}"),("Section III - Specific Tournament Conditions",r"^III\.\s+SPECIFIC TOURNAMENT CONDITIONS"),("Section IV - Awarding of USPA Events",r"^IV\.\s+AWARDING OF USPA EVENTS"),("Section V - Tournament Fees and Charges",r"^V\.\s+TOURNAMENT FEES AND CHARGES"),("Section VI - Entries, Draws, and Scheduling",r"^VI\.\s+ENTRIES,\s*DRAWS,?\s+AND SCHEDULING"),("Section VII - Host Tournament Committee Responsibilities",r"^VII\.\s+HOST TOURNAMENT COMMITTEE RESPONSIBILITIES"),("Section VIII - Instant Replay",r"^VIII\.\s+INSTANT REPLAY"),("Section IX - [Reserved]",r"^IX\.\s+\[RESERVED\]"),("Section X - Optional Tournament Condition for USPA Outdoor Rule 2.d",r"^X\.\s+OPTIONAL\s+TOURNAMENT CONDITION FOR USPA OUTDOOR RULE 2\.d"),("Section XI - Optional Tournament Condition for USPA Outdoor Rule 8.a",r"^XI\.\s+OPTIONAL\s*TOURNAMENT CONDITION FOR USPA OUTDOOR RULE 8\.a"),("Section XII - Optional Tournament Condition for USPA Outdoor Rule 19.b",r"^XII\.\s+OPTIONAL TOURNAMENT CONDITION FOR USPA OUTDOOR RULE\s*\n\s*19\.b"),("Section XIII - Optional Tournament Condition for USPA Outdoor Rule 2.a",r"^XIII\.\s+OPTIONAL\s*TOURNAMENT\s*CONDITION FOR USPA\s*OUTDOOR RULE 2\.a"),("Section XIV - Optional Tournament Condition for USPA Outdoor Rule 14.b",r"^XIV\.\s+OPTIONAL TOURNAMENT CONDITION FOR USPA OUTDOOR RULE\s*\n\s*14\.b")]
    add("tournament-conditions","Tournament Conditions","Tournament Conditions",155,182,lambda rows,mt:split_named("tournament-conditions",mt,tc),["Tournament Conditions"],["event","host","tournament","committee","affiliate","country"])
    add("nyts-tournament-conditions","National Youth Tournament Series Tournament Conditions","NYTS Tournament Conditions",183,186,lambda rows,mt:split_named("nyts-tournament-conditions",mt,[("Section I - National Youth Tournament Series",r"^I\.\s+National Youth Tournament Series")]),["NYTS Tournament Conditions","National Youth Tournament Series Tournament Conditions"],["youth","nyts","eligibility"])

    def alt(rows,mt):
        specs=[("Introduction; Overview; Exceptions",r"^INTRODUCTION;\s*OVERVIEW;\s*EXCEPTIONS")]
        for m in re.finditer(r"^RULE\s*-?\s*(\d+)\s*[-–]\s*([^\n]+)",mt,re.I|re.M):
            specs.append((f"Rule {m.group(1)} - {m.group(2).strip()}",r"^RULE\s*-?\s*"+m.group(1)+r"\s*[-–]\s*"+re.escape(m.group(2).strip())))
        return split_named("alternative-format-arena",mt,specs)
    add("alternative-format-arena","Optional Tournament Conditions for Alternative Format Arena Polo","Alternative Format Arena",187,190,alt,["Alternative Format Arena Conditions","Alternative Format Arena Polo Tournament Conditions","Alternative Format Polo Rules"],["beach","snow","stadium","arena","alternative"])

    ii=["A. General Program Information","B. Games/Events","C. Tournaments","D. Intercollegiate Eligibility","E. Interscholastic Eligibility","F. National Alumni Tournament","G. Middle School Tournament","H. Coaches’ Eligibility","I. Required Forms","J. Violations and Penalties"]
    add("intercollegiate-interscholastic","Intercollegiate/Interscholastic Tournament Conditions","I/I Tournament Conditions",191,212,lambda rows,mt:split_named("intercollegiate-interscholastic",mt,[(x,r"^"+re.escape(x)+r"$") for x in ii]),["Intercollegiate/Interscholastic Tournament Conditions","I/I Tournament Conditions"],["student","eligibility","coach"])
    emr=[("Rule 1 - Permitted Medications",r"^1\.\s+PERMITTED MEDICATIONS$"),("Rule 2 - Restricted Use Medications",r"^2\.\s+RESTRICTED USE MEDICATIONS$"),("Rule 3 - Prohibited Medications and Substances",r"^3\.\s+PROHIBITED MEDICATIONS AND SUBSTANCES$"),("Rule 4 - Therapeutic Medication Use",r"^4\.\s+THERAPEUTIC MEDICATION USE$"),("Rule 5 - Responsible Parties Under These Rules",r"^5\.\s+RESPONSIBLE PARTIES UNDER THESE RULES$"),("Rule 6 - Testing Procedure and Protocol",r"^6\.\s+TESTING PROCEDURE AND PROTOCOL$"),("Rule 7 - Presumed Violation for Positive Test",r"^7\.\s+PRESUMED VIOLATION FOR POSITIVE TEST$"),("Rule 8 - Use of Guidelines and Comments",r"^8\.\s+USE OF GUIDELINES AND COMMENTS$")]
    add("equine-medications","Equine Medications Rules","Equine Medications",213,222,lambda rows,mt:split_named("equine-medications",mt,emr),["Equine Medication Rules","Equine Medications Rules"],["horse","equine","medication","testing"])

    ug=[("Introduction",r"^INTRODUCTION$"),("Umpire Certification Procedure",r"^UMPIRE CERTIFICATION PROCEDURE$"),("How to Hire a Professional Umpire",r"^HOW TO HIRE A PROFESSIONAL UMPIRE$"),("Umpire Certification Program Standards and Qualifications",r"^UMPIRE CERTIFICATION PROGRAM\s*\n\s*STANDARDS AND QUALIFICATIONS$"),("USPA Instructors and Professional Umpires",r"^USPA INSTRUCTORS$"),("Outdoor Rules: Misexecution of Penalty Shots, Knock-Ins",r"^OUTDOOR RULES:\s*MISEXECUTION OF PENALTY SHOTS,\s*KNOCK-INS$"),("Arena Rules: Misexecution of Penalty Shots",r"^ARENA RULES:\s*MISEXECUTION OF PENALTY SHOTS$"),("Outdoor Handicap Matrix",r"^OUTDOOR HANDICAP MATRIX$"),("Arena Handicap Matrix",r"^ARENA HANDICAP MATRIX$")]
    add("umpire-guide","Umpire Guide","Umpire Guide",223,240,lambda rows,mt:split_named("umpire-guide",mt,ug),["Umpire Guide"],["umpire","referee","procedure"])

    policies=[("Broadcast Rights, Title Sponsorships and Trademark Policy",241),("Governor Censure Policy",245),("Club Information Update Policy",247),("Code of Conduct",249),("USPA Committee Information",251),("Audit Committee Charter",252),("High Goal Committee Policy",254),("International Committee Policy",260),("Young Players Committee Policy",261),("Concussion Guidelines",263),("Conflict of Interest Policy",267),("Code of Ethics",274),("Disciplinary Procedures Policy",277),("Equal Opportunity and Commitment to Diversity/Inclusion Policy",297),("Governance Communication Policy",301),("Handicap Policy",305),("Henneke Body Condition Score Chart",321),("Large Expenditures Policy",323),("Logo Usage Policy",327),("Member Demographic Policy",329),("NOAA's National Weather Service Heat Index Chart",329),("Policy Concerning the Retention of Outside Legal Counsel",332),("Procurement Policy",333),("USPA Ethics and Compliance Reporting Policy",337),("Youth Protection Policy",339)]
    def pol(rows,mt):
        out=page_sections("policies",rows,[(t,p,i) for i,(t,p) in enumerate(policies)],364)
        parts=[("Part I - Sport-Related Conduct Violation Procedures",r"^PART I:\s*\n\s*SPORT-RELATED CONDUCT VIOLATION PROCEDURES$"),("Part II - Membership-Related Conduct Violation Procedures",r"^PART II:\s*\n\s*MEMBERSHIP-RELATED CONDUCT VIOLATION PROCEDURES$"),("Part III - Sport Protest Procedures",r"^PART III:\s*\n\s*SPORT PROTEST PROCEDURES$"),("Part IV - Equine Medications Rules Violation Procedures",r"^PART IV:\s*\n\s*EQUINE MEDICATIONS RULES VIOLATION PROCEDURES$")]
        return out+split_named("policies",mt,parts)
    add("policies","USPA Policies","Policies",241,364,pol,["Policies","Sport-Related Conduct Procedures","Equine Welfare Policies"],["conduct","disciplinary","protest","ethics","concussion","handicap","welfare"])

    DATA_DIR.mkdir(parents=True,exist_ok=True)
    sha=hashlib.sha256(PDF.read_bytes()).hexdigest()
    generated=datetime.now(timezone.utc).isoformat()
    payload={"source":{"organization":"United States Polo Association","title":f"{year} Rulebook of the United States Polo Association","year":year,"sha256":sha,"generatedAt":generated},"resources":resources}
    outfile=DATA_DIR/f"resources-{year}.json"
    outfile.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    manifest=json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    manifest["resourcesFile"]=f"data/resources-{year}.json"
    manifest.setdefault("counts",{})["resources"]=len(resources)
    manifest["counts"]["resourceSections"]=sum(len(x["sections"]) for x in resources)
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"resources":len(resources),"sections":manifest["counts"]["resourceSections"],"file":str(outfile)},indent=2))

if __name__=="__main__":
    main()
