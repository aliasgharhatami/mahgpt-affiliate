"""Optional Instagram Login token maintenance, not a way to revive expired tokens.

Requires currently VALID long-lived IG user token (>=24h old), and a fine-grained
GitHub PAT with Actions Secrets write permission stored as GITI_GH_SECRETS_PAT.
Never displays old/new tokens, never commits them, never posts Instagram content.
"""
import base64,json,os,sys,urllib.request,urllib.parse

REPO="aliasgharhatami/mahgpt-affiliate"
def request(url,method="GET",body=None,headers=None):
 data=None if body is None else json.dumps(body).encode()
 req=urllib.request.Request(url,data=data,method=method,headers=headers or {})
 with urllib.request.urlopen(req,timeout=25) as response:
  return json.loads(response.read(16000))
def renew(old,github_pat,requester=request):
 if not old or not github_pat:raise ValueError("Existing Instagram token and Giti secret-editor PAT required")
 params=urllib.parse.urlencode({"grant_type":"ig_refresh_token","access_token":old})
 data=requester("https://graph.instagram.com/refresh_access_token?"+params)
 updated=data.get("access_token")
 if not isinstance(updated,str) or len(updated)<40:raise ValueError("Instagram returned no usable refreshed token")
 remaining=int(data.get("expires_in",0))
 if remaining<7*86400:raise ValueError("Unexpectedly short token lifetime; no secrets changed")
 base="https://api.github.com/repos/"+REPO+"/actions/secrets"
 headers={"Authorization":"Bearer "+github_pat,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"GerdeGitiTokenMaintenance/1.0"}
 public=requester(base+"/public-key",headers=headers)
 from nacl.public import PublicKey,SealedBox
 key=PublicKey(base64.b64decode(public["key"]))
 cipher=SealedBox(key).encrypt(updated.encode("utf-8"))
 payload={"encrypted_value":base64.b64encode(cipher).decode("ascii"),"key_id":public["key_id"]}
 # PUT 201 creates and 204 updates; both accepted by urllib as normal success
 requester(base+"/INSTAGRAM_ACCESS_TOKEN",method="PUT",body=payload,headers={**headers,"Content-Type":"application/json"})
 return {"refreshed":True,"expires_in_days":round(remaining/86400),"stored_in_github_secret":True}
def main():
 if "--dry-run" in sys.argv:
  print("Syntax/preflight only. Would refresh valid Instagram Login token and update encrypted repository Secret.")
  return
 if os.environ.get("GITHUB_REPOSITORY")!=REPO:raise RuntimeError("Refusing to update token in wrong repository")
 old=os.getenv("INSTAGRAM_ACCESS_TOKEN")
 editor=os.getenv("GITI_GH_SECRETS_PAT")
 if not old or not editor:
  print("Refresh disabled until the expired token is replaced and an authorized repository Secrets-editing PAT is provided.")
  return
 try:print(json.dumps(renew(old,editor)))
 except Exception as e:
  print("Instagram token renewal failed; no public posts attempted. Error type: "+type(e).__name__)
  raise
if __name__=="__main__":main()
