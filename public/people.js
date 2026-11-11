'use strict';
const form=document.getElementById('people-form');
const result=document.getElementById('people-result');
form?.addEventListener('submit',async event=>{
  event.preventDefault();
  const data=new FormData(form);
  const body={display_name:String(data.get('display_name')||''),bio:String(data.get('bio')||''),website:String(data.get('website')||''),visible:data.has('visible')};
  const response=await fetch('/api/v1/people/me',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  result.textContent=response.ok?'Saved. Your visibility choice is now active.':'Could not save this listing.';
});
document.getElementById('delete-listing')?.addEventListener('click',async()=>{
  if(!confirm('Delete your listing?'))return;
  const response=await fetch('/api/v1/people/me',{method:'DELETE'});
  result.textContent=response.ok?'Listing deleted.':'Could not delete this listing.';
  if(response.ok)form.reset();
});
