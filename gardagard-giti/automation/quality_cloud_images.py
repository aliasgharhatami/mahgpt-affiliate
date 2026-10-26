"""Cloud-only scene asset resolver for Gerde Giti.

Order:
  1. Use a real event photo ONLY if rights and story provenance are recorded.
  2. If no cleared photo exists, create a scene-specific reconstruction via Gemini
     image API ONLY when the user separately opted in to a strictly bounded paid
     generation request.  Never use random archival photos to substitute an event.

IMPORTANT: Google's current image generation API has NO free tier. The default
mode is NO-CHARGE and hard-fails rather than using it. No publication occurs here.
"""
from __future__ import annotations
import argparse,json,os,pathlib,re,sys

def generate(prompt,target):
    from google import genai
    from google.genai import types
    model="gemini-3.1-flash-image"
    client=genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response=client.models.generate_content(
        model=model,
        contents=("Create a SINGLE photographic 9:16 vertical documentary illustration for "
          "an original local-news Persian Reel. It is an AI reconstruction of the news, "
          "NOT actual documentary footage. Keep the scene period-correct, geographically "
          "plausible, visually credible, coherent and specific to the provided event. "
          "No text, no watermark, no typography, no logos, no fabricated documents. "
          "The overlay captions and logo are added later by a different program. "
          "Avoid depicting real identifiable people if accuracy cannot be verified. "
          "Camera: sophisticated editorial photography, consistent natural lighting "
          "and realistic anatomy. Scene brief: "+prompt),
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(aspect_ratio="9:16",image_size="2K")))
    for part in response.parts:
        image=part.as_image() if hasattr(part,"as_image") else None
        if image is not None:
            image.save(str(target))
            return model
    raise RuntimeError("Image provider returned no image; never substitute unrelated stock art")

def resolve(job_file,out,allow_charges=False,max_images=0):
    inp=pathlib.Path(job_file)
    job=json.loads(inp.read_text(encoding="utf-8"))
    if job.get("schema")!="gerde-giti/quality-cloud/v1":raise ValueError("Bad job schema")
    scenes=job.get("scenes",[])
    folder=pathlib.Path(out);folder.mkdir(parents=True,exist_ok=True)
    required=[(i,x) for i,x in enumerate(scenes) if not (x.get("image_url") or x.get("path"))]
    if required:
        if not allow_charges or os.getenv("GITI_PAID_IMAGE_API_APPROVED")!="yes":
            raise RuntimeError(
                "No approved real news photo for "+str(len(required))+
                " scenes. Image API is not free; no payment authorization, "
                "so do not quietly use random archival images.")
        if len(required)>max_images or max_images<1 or max_images>5:
            raise RuntimeError("Paid image count cap exceeded (max 5 per run)")
        if os.getenv("GITI_CLOUD_IMAGE_PROVIDER")!="gemini-3.1-flash-image":
            raise RuntimeError("Explicitly selected paid provider is required")
        if not os.getenv("GEMINI_API_KEY"):raise RuntimeError("No image provider API credentials")
    for i,s in enumerate(scenes):
        if s.get("kind")=="actual":
            if not s.get("rights_evidence_url","").startswith("https://"):
                raise RuntimeError("Real news photograph must have original provenance")
            if not s.get("license") and not s.get("rights_permission"):
                raise RuntimeError("Do not assume published photographs are free to reuse")
        elif s.get("kind")=="reconstruction":
            if not s.get("image_generator") or not (s.get("path") or s.get("image_url")):
                if not any(j==i for j,_ in required):raise RuntimeError("Reconstruction missing metadata")
        else:raise RuntimeError("Only real licensed photo or marked reconstruction is supported")
    for i,scene in required:
        desc=scene.get("visual_prompt")
        if not isinstance(desc,str) or len(desc)<35:
            raise RuntimeError("Precise visual prompt required, not generic keyword")
        target=folder/("generated-%02d.png"%(i+1))
        provider=generate(desc,target)
        scene.update(path=str(target),kind="reconstruction",
            image_generator=provider,
            story_relevance_checked=False,
            human_subject_accuracy_reviewed=False,
            generated_for_review=True)
    result=folder/"asset_resolved_review_only.json"
    result.write_text(json.dumps(job,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("ASSETS_PREPARED_REVIEW_ONLY",str(result))
    return result

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--job",required=True);p.add_argument("--out",required=True)
    p.add_argument("--authorize-paid-images",action="store_true")
    p.add_argument("--max-paid-images",type=int,default=0)
    a=p.parse_args()
    resolve(a.job,a.out,a.authorize_paid_images,a.max_paid_images)
