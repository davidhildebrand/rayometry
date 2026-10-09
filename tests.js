(function(){
'use strict';
const P=typeof require==='function'?require('./physics.js'):Optics;
if(typeof require==='function'){require('./scene.js');require('./measurements.js');}
const S=BenchScene,M=BenchMeasurements,results=[],rad=x=>x*Math.PI/180;
function assert(x,message='Assertion failed'){if(!x)throw Error(message);}
function close(a,b,tol=1e-8){assert(Math.abs(a-b)<tol,`${a} differs from ${b}`);}
function test(name,fn){try{fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.message});}}
const b={x:500,y:325,width:360,height:240,angle:0,index:1.5},bounds={width:1000,height:650};
const refract=(a,n1,n2)=>P.snell({x:Math.sin(rad(a)),y:-Math.cos(rad(a))},{x:0,y:1},n1,n2);
test('Normal incidence is undeviated',()=>{const r=refract(0,1,1.5);close(r.direction.x,0);close(r.outgoingAngle,0);});
test('Equal indices preserve direction',()=>{const r=refract(63,1.5,1.5);close(r.outgoingAngle,rad(63));});
test('Air to glass obeys Snell and bends toward normal',()=>{const r=refract(45,1,1.5);close(Math.sin(r.outgoingAngle)*1.5,Math.sin(rad(45)));assert(r.outgoingAngle<r.incidence);});
test('Glass to air bends away from normal',()=>{const r=refract(30,1.5,1);close(r.outgoingAngle,Math.asin(.75));assert(r.outgoingAngle>r.incidence);});
test('Critical angle gives a grazing transmitted ray',()=>{const r=refract(Math.asin(1/1.5)*180/Math.PI,1.5,1);assert(!r.tir);close(r.outgoingAngle,Math.PI/2);close(r.direction.y,0);});
test('Above critical angle reflects with equal angles',()=>{const r=refract(50,1.5,1);assert(r.tir);close(r.incidence,r.outgoingAngle);assert(r.direction.y>0);});
test('Immediately below/above critical angle',()=>{const c=Math.asin(1/1.5)*180/Math.PI;assert(!refract(c-1e-5,1.5,1).tir);assert(refract(c+1e-5,1.5,1).tir);});
test('Opposite parallel faces produce parallel emergent ray',()=>{const d=P.direction(rad(10)),t=P.trace({x:100,y:300},d,b,1,bounds);assert(t.events.length===2);close(t.events[1].direction.x,d.x);close(t.events[1].direction.y,d.y);});
test('Rotated block preserves parallel emergent ray',()=>{const d=P.direction(rad(20)),t=P.trace({x:100,y:180},d,{...b,angle:rad(20)},1,bounds);assert(t.events.length===2);close(t.events[1].direction.x,d.x);});
test('Default is 50° upper-face TIR followed by side exit',()=>{const t=S.rays(S.defaults())[0];assert(t.events.length===2);assert(t.events[0].face==='y-1'&&t.events[0].tir);close(t.events[0].incidence,rad(50));assert(!t.events[1].tir);});
test('Trapped internal ray stops at 20 hits',()=>{const t=P.trace({x:490,y:330},P.direction(rad(45)),b,1,bounds);assert(t.events.length===20);assert(t.warning.includes('20'));});
test('Source on boundary requests repositioning',()=>{assert(P.trace({x:320,y:325},{x:1,y:0},b,1,bounds).warning.includes('boundary'));});
test('Exact corner hit requests adjustment',()=>{const t=P.trace({x:100,y:100},P.unit({x:220,y:105}),b,1,bounds);assert(t.warning.includes('corner'));});
test('Near-boundary source has no self-intersection',()=>{const t=P.trace({x:320.00001,y:325},{x:1,y:0},b,1,bounds);assert(t.events.length===1);close(t.events[0].point.x,680);});
test('Missing block ends at board edge',()=>{const t=P.trace({x:30,y:50},{x:1,y:0},b,1,bounds);assert(t.events.length===0);close(t.segments[0].to.x,1000);});
test('Extreme finite indices at normal incidence stay finite',()=>{const r=refract(0,1e300,1e-300);assert(Number.isFinite(r.direction.y));});
test('Invalid indices rejected',()=>{let caught=false;try{refract(20,0,1);}catch(e){caught=true;}assert(caught);});
test('Surface pivot keeps distance and first entry point',()=>{const s=S.defaults();assert(S.lockPivot(s));const pivot={...s.pivot.point},distance=s.pivot.distance;assert(S.rotateSource(s,rad(-45)));close(P.length(P.sub(s.source,pivot)),distance);const hit=S.rays(s)[0].events[0];close(P.length(P.sub(hit.point,pivot)),0);});
test('Surface pivot stops before invalid first-hit geometry',()=>{const s=S.defaults();S.lockPivot(s);assert(!S.rotateSource(s,rad(100)));const hit=S.rays(s)[0].events[0];close(P.length(P.sub(hit.point,s.pivot.point)),0);});
test('Five rays are traced independently',()=>{const s=S.defaults();s.source.count=5;const t=S.rays(s);assert(t.length===5);t.forEach(r=>close(r.events[0].incidence,rad(50)));});
test('Defaults are independent fresh objects',()=>{const s=S.defaults();s.block.index=2;assert(S.defaults().block.index===1.5);});
test('Critical snap is narrow and works with both pivots',()=>{
 for(const pivot of [false,true]){
  const s=S.defaults();if(pivot)S.lockPivot(s);
  const target=Math.asin(1/1.5)-Math.PI/2;
  for(const offset of [-.2,.2])close(S.snapSourceAngle(s,target+rad(offset)),target);
  close(S.snapSourceAngle(s,target+rad(.5)),target+rad(.5));
  const snapped=S.snapSourceAngle(s,target+rad(.2));S.rotateSource(s,snapped);
  assert(S.rays(s)[0].events[0].critical);
 }
});
test('Critical snap does not apply to equal indices',()=>{const s=S.defaults();s.block.index=1;const a=rad(-48.1);close(S.snapSourceAngle(s,a),a);});
test('All triangle presets have their specified corner angles and fit the board',()=>{
 for(const key of ['prism45','prism30','equilateral']){
  const s=S.defaults();S.applyPreset(s,key);const v=P.vertices(s.block);assert(v.length===3);assert(S.blockFits(s.block,s));
  v.forEach((point,i)=>{const a=P.unit(P.sub(v[(i+2)%3],point)),b=P.unit(P.sub(v[(i+1)%3],point));close(Math.acos(P.dot(a,b)),rad(S.presets[key].corners[i]));});
  assert(P.location(s.source,s.block)==='outside');assert(S.rays(s)[0].events.length>=2);
 }
});
test('45 degree lab table matches analytic Snell predictions at both surfaces',()=>{
 const s=S.defaults();S.applyPreset(s,'prism45');s.block.index=1.49;S.lockPivot(s);
 for(const incidence of [10,20,30,40,50]){
  assert(S.rotateSource(s,rad(-incidence)));const path=S.rays(s)[0];assert(path.events.length===2);
  const [entry,exit]=path.events;assert(entry.face==='edge2'&&exit.face==='edge0');
  const r1=Math.asin(Math.sin(rad(incidence))/1.49),i2=rad(45)-r1,t2=Math.asin(1.49*Math.sin(i2));
  close(entry.incidence,rad(incidence));close(entry.outgoingAngle,r1);close(exit.incidence,i2);close(exit.outgoingAngle,t2);
  close(S.deviation(path),rad(incidence)+t2-rad(45));
 }
});
test('Normal entry through 45 degree prism produces second-face TIR and subsequent exit',()=>{
 const s=S.defaults();S.applyPreset(s,'prism45');s.block.index=1.49;S.lockPivot(s);S.rotateSource(s,0);
 const path=S.rays(s)[0];close(path.events[0].incidence,0);close(path.events[1].incidence,rad(45));
 assert(path.events[1].tir);assert(path.events.length===3&&!path.events[2].tir);assert(S.deviation(path)===null);
});
test('Prism exit-face critical angle snaps with both source pivots',()=>{
 for(const pivot of [false,true]){
  const s=S.defaults();S.applyPreset(s,'prism45');s.block.index=1.49;if(pivot)S.lockPivot(s);
  const critical=Math.asin(1/1.49),entry=Math.asin(1.49*Math.sin(rad(45)-critical));
  for(const offset of [-.15,.15]){
   const a=S.snapSourceAngle(s,-entry+rad(offset));close(a,-entry);assert(S.rotateSource(s,a));
   const path=S.rays(s)[0];assert(path.events[1].critical);close(path.events[1].outgoingAngle,Math.PI/2);
  }
 }
});
test('Prism minimum deviation has equal incidence and emergence',()=>{
 const s=S.defaults();S.applyPreset(s,'prism45');s.block.index=1.49;S.lockPivot(s);
 const incidence=Math.asin(1.49*Math.sin(rad(22.5)));S.rotateSource(s,-incidence);
 const path=S.rays(s)[0];close(path.events[1].outgoingAngle,incidence);close(S.deviation(path),2*incidence-rad(45));
});
test('Rotating whole prism experiment preserves optical angles',()=>{
 const s=S.defaults();S.applyPreset(s,'prism45');const old=S.rays(s)[0];const angle=rad(25);
 const pos=P.add(s.block,P.rotate(P.sub(s.source,s.block),angle));Object.assign(s.source,pos);s.source.angle+=angle;s.block.angle+=angle;
 const path=S.rays(s)[0];assert(path.events.length===old.events.length);path.events.forEach((e,i)=>close(e.incidence,old.events[i].incidence));
});
test('Polygon boundary and corner ambiguity are detected',()=>{
 const s=S.defaults();S.applyPreset(s,'prism45');const v=P.worldVertices(s.block);
 assert(P.location(v[0],s.block)==='boundary');const d=P.unit(P.sub(v[0],s.source));
 assert(P.trace(s.source,d,s.block,1,s).warning.includes('corner'));
 assert(P.location(s.block,s.block)==='inside');
});
test('Preset changes preserve media, ray count and rotation preference',()=>{
 const s=S.defaults();s.block.index=1.523;s.outsideIndex=1.1;s.source.count=5;s.rotationMode='surface';
 S.applyPreset(s,'equilateral');assert(s.pivot);assert(s.block.index===1.523&&s.outsideIndex===1.1&&s.source.count===5&&s.rotationMode==='surface');
 S.applyPreset(s,'rectangle');assert(!s.block.vertices&&s.pivot);
});
test('Minimum deviation snaps for all prism presets in both pivot modes',()=>{
 for(const key of ['prism45','prism30','equilateral'])for(const pivot of [false,true]){
  const s=S.defaults();S.applyPreset(s,key);s.block.index=1.49;
  const target=-Math.asin(1.49*Math.sin(rad(S.presets[key].corners[0]/2)));
  // Aim near the minimum while retaining the preset entry point.
  S.lockPivot(s);assert(S.rotateSource(s,target));if(!pivot)s.pivot=null;
  for(const offset of [-.2,.2]){const snapped=S.snapSourceAngle(s,target+rad(offset));close(snapped,target);assert(S.rotateSource(s,snapped));assert(S.minimumDeviation(s,S.rays(s)[0]));}
  close(S.snapSourceAngle(s,target+rad(.5)),target+rad(.5));
 }
});
test('Minimum deviation cue is absent for rectangles, TIR and equal indices',()=>{
 const s=S.defaults();assert(!S.minimumDeviation(s,S.rays(s)[0]));S.applyPreset(s,'prism45');s.source.angle=0;assert(!S.minimumDeviation(s,S.rays(s)[0]));s.block.index=1;assert(!S.minimumDeviation(s,S.rays(s)[0]));
});
test('Exact placement buttons reach minimum and critical for all prism presets',()=>{
 for(const key of ['prism45','prism30','equilateral'])for(const mode of ['source','surface']){
  const s=S.defaults();S.applyPreset(s,key);s.rotationMode=mode;const point=S.rays(s)[0].events[0].point;
  for(const kind of ['minimum','critical']){
   const result=S.placeAtSpecialAngle(s,kind);assert(result.ok,result.message);const path=S.rays(s)[0];
   assert(kind==='minimum'?S.minimumDeviation(s,path):path.events.some(e=>e.critical));
   close(P.length(P.sub(path.events[0].point,point)),0);assert(s.rotationMode===mode);assert(Boolean(s.pivot)===(mode==='surface'));
  }
 }
});
test('Critical placement works inside block; invalid placement leaves scene untouched',()=>{
 const s=S.defaults();assert(S.placeAtSpecialAngle(s,'critical').ok);assert(S.rays(s)[0].events[0].critical);
 const before=JSON.stringify(s);assert(!S.placeAtSpecialAngle(s,'minimum').ok);assert(JSON.stringify(s)===before);
 s.block.index=s.outsideIndex;const equal=JSON.stringify(s);assert(!S.placeAtSpecialAngle(s,'critical').ok);assert(JSON.stringify(s)===equal);
});
test('Semicircle flat-first three-ray preset refracts at the radial curved surface',()=>{
 const s=S.defaults();S.applyPreset(s,'semicircle');assert(s.source.count===3);const paths=S.rays(s);
 paths.forEach(path=>{assert(path.events.length===2);const [flat,arc]=path.events;assert(flat.face==='flat'&&arc.face==='arc');close(flat.incidence,0);const radial=P.unit(P.sub(arc.point,s.block));close(Math.abs(P.dot(radial,arc.normal)),1);close(1.5*Math.sin(arc.incidence),Math.sin(arc.outgoingAngle));});
 close(paths[1].events[1].outgoingAngle,0);assert(paths[0].events[1].direction.y>0&&paths[2].events[1].direction.y<0);
 const e=paths[0].events[1],focus=e.point.x+(s.block.y-e.point.y)*e.direction.x/e.direction.y;
 assert(Math.abs((focus-(s.block.x+s.block.radius))-s.block.radius/(s.block.index-1))<5);
});
test('Semicircle curved-first rays refract again at flat exit',()=>{
 const s=S.defaults();S.applyPreset(s,'semicircle');s.block.angle=Math.PI;const path=S.rays(s)[0];
 assert(path.events.length===2);assert(path.events[0].face==='arc'&&path.events[1].face==='flat');
 const [entry,exit]=path.events;assert(Math.abs(entry.direction.y)>0);assert(Math.abs(exit.direction.y)>Math.abs(entry.direction.y));
 const internalFocus=entry.point.x+(s.block.y-entry.point.y)*entry.direction.x/entry.direction.y;
 assert(Math.abs(internalFocus-(s.block.x-s.block.radius)-s.block.index*s.block.radius/(s.block.index-1))<5);
});
test('Semicircle bounds and medium classification follow rotation',()=>{
 const s=S.defaults();S.applyPreset(s,'semicircle');assert(P.location({x:500,y:325},s.block)==='inside');assert(P.location({x:400,y:325},s.block)==='outside');assert(P.location({x:450,y:325},s.block)==='boundary');
 s.block.angle=Math.PI/2;assert(S.blockFits(s.block,s));assert(P.location({x:450,y:375},s.block)==='inside');
 const bound=P.worldVertices(s.block);close(Math.max(...bound.map(p=>p.y)),475);close(Math.min(...bound.map(p=>p.y)),325);
});
test('Semicircle handles corners, tangents and internal TIR',()=>{
 const s=S.defaults();S.applyPreset(s,'semicircle');const b=s.block;
 assert(P.trace({x:250,y:175},{x:1,y:0},b,1,s).warning.includes('corner'));
 const tangent=P.trace({x:600,y:100},{x:0,y:1},b,1,s);assert(tangent.events.length===0);
 const tir=P.trace({x:460,y:445},{x:1,y:0},b,1,s);assert(tir.events[0].face==='arc'&&tir.events[0].tir);
});
test('Changing curve depth preserves endpoints and updates radius, normals and refraction',()=>{
 const s=S.defaults();S.applyPreset(s,'semicircle');const originalAngle=S.rays(s)[0].events[1].outgoingAngle;
 assert(S.setCurveDepth(s,75));const g=P.curvedGeometry(s.block);close(g.radius,187.5);close(g.center.x,-112.5);
 for(const y of [-150,150])assert(P.location(P.add(s.block,{x:0,y}),s.block)==='boundary');
 assert(P.location(P.add(s.block,{x:75,y:0}),s.block)==='boundary');assert(P.location(P.add(s.block,{x:100,y:0}),s.block)==='outside');
 const e=S.rays(s)[0].events[1],center=P.add(s.block,g.center);close(Math.abs(P.dot(P.unit(P.sub(e.point,center)),e.normal)),1);assert(e.outgoingAngle<originalAngle);
 close(Math.sin(e.incidence)*s.block.index,Math.sin(e.outgoingAngle));
});
test('Curvature bounds, rotation and restoration remain exact',()=>{
 const s=S.defaults();S.applyPreset(s,'semicircle');S.setCurveDepth(s,-10);close(P.curvedGeometry(s.block).sag,30);
 s.block.angle=Math.PI/2;const vertices=P.worldVertices(s.block);close(Math.max(...vertices.map(p=>p.y)),355);assert(S.blockFits(s.block,s));
 S.setCurveDepth(s,1000);close(P.curvedGeometry(s.block).sag,150);close(P.curvedGeometry(s.block).radius,150);
 const before=JSON.stringify(s);assert(!S.setCurveDepth(s,NaN));assert(JSON.stringify(s)===before);
});
test('Physical scale agrees with ruler, grid and radius',()=>{
 close(M.mm(M.gridStep),5);close(M.distance({x:0,y:0},{x:150,y:200}),75);
 const s=S.defaults();S.applyPreset(s,'semicircle');close(M.mm(P.curvedGeometry(s.block).radius),45);close(M.mm(2*P.curvedGeometry(s.block).halfHeight),90);assert(M.setRadius(s,56.25));close(M.mm(P.curvedGeometry(s.block).radius),56.25);
 close(P.curvedGeometry(s.block).sag,75);const before=JSON.stringify(s);for(const bad of [0,44,118,Infinity,NaN])assert(!M.setRadius(s,bad));assert(JSON.stringify(s)===before);
});
test('Internal extensions continue the pre-exit direction without changing traced rays',()=>{
 const s=S.defaults();S.applyPreset(s,'semicircle');assert(M.extensions(s,S.rays(s)).length===0);s.block.angle=Math.PI;
 const paths=S.rays(s),before=JSON.stringify(paths),lines=M.extensions(s,paths);assert(lines.length===3);
 lines.forEach((line,i)=>{close(P.length(P.sub(line.from,paths[i].events[1].point)),0);close(P.dot(line.direction,paths[i].events[0].direction),1);assert(line.to.x<=s.width+1e-8&&line.to.y<=s.height+1e-8);});
 assert(JSON.stringify(paths)===before);
 s.extensions=true;const targets=M.targets(s,paths);assert(targets.some(p=>p.label==='Extended-ray crossing'));assert(targets.some(p=>p.label==='Ray crossing'));
 const internal=targets.find(p=>p.label==='Extended-ray crossing'),emergent=targets.find(p=>p.label==='Ray crossing');assert(internal.x>emergent.x);
});
test('Ruler snapping selects physical points and can be disabled',()=>{
 const s=S.defaults();S.applyPreset(s,'semicircle');const paths=S.rays(s);const c=M.snap({x:451,y:326},s,paths);close(c.x,450);close(c.y,325);assert(c.label==='C');
 const a=M.snap({x:602,y:325},s,paths);close(a.x,600);assert(a.label==='A');
 s.ruler.snap=false;const free=M.snap({x:602,y:325},s,paths);close(free.x,602);
 const bounded=M.snap({x:-10,y:900},s,paths);close(bounded.x,0);close(bounded.y,650);
});
// Photon billiards: deterministic pseudo-random targets so the checks are repeatable.
function lcg(seed){let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};}
test('Random billiard target is reachable, outside the block and on the board',()=>{
 for(const [preset,seed]of [[null,1],['prism45',2],['semicircle',3],['equilateral',4],['prism30',5]]){
  const s=S.defaults();if(preset)S.applyPreset(s,preset);
  assert(s.billiards.hole===null);assert(S.randomTarget(s,lcg(seed)),'no target for '+preset);
  const b=s.billiards;assert(b.hole&&S.inBoard(b.hole,s,b.hole.r));assert(P.location(b.hole,s.block)==='outside');assert(S.holeFits(s,b.hole));
  assert(P.length(P.sub(b.hole,s.source))>=180);assert(b.targets===1&&b.attempts===0&&b.shot==='idle');
  const path=P.trace(s.source,P.direction(b.solution),s.block,s.outsideIndex,s);
  assert(!path.warning&&path.events.length>=1,'solution must pass through the block');
  const result=S.hitTest(path,b.hole);assert(result.hit);close(result.distance,0,1e-6);
  const turn=Math.abs(Math.atan2(Math.sin(b.solution-s.source.angle),Math.cos(b.solution-s.source.angle)));
  assert(turn<=S.TARGET_SPREAD+1e-9,`solution needs a ${turn*180/Math.PI}° turn for ${preset}`);
 }
});
test('Targets stay within 20° of the current aim over many draws',()=>{
 const random=lcg(11);
 for(let i=0;i<40;i++){
  const s=S.defaults();s.source.angle=rad(-180+9*i);assert(S.randomTarget(s,random));
  const turn=Math.abs(Math.atan2(Math.sin(s.billiards.solution-s.source.angle),Math.cos(s.billiards.solution-s.source.angle)));
  assert(turn<=rad(20)+1e-9);
 }
});
test('Random targets differ between draws and reset the attempt count',()=>{
 const s=S.defaults(),random=lcg(7);S.randomTarget(s,random);const first={...s.billiards.hole};s.billiards.attempts=3;
 S.randomTarget(s,random);assert(P.length(P.sub(s.billiards.hole,first))>1);assert(s.billiards.attempts===0&&s.billiards.targets===2);
});
test('Hit test sinks only within the hole radius and reports the closest approach',()=>{
 const path=P.trace({x:100,y:100},{x:1,y:0},b,1,bounds);assert(path.events.length===0);
 const miss=S.hitTest(path,{x:600,y:140,r:20});assert(!miss.hit);close(miss.distance,40);close(miss.point.x,600);close(miss.point.y,100);
 const hit=S.hitTest(path,{x:600,y:112,r:20});assert(hit.hit&&hit.segment===0);close(hit.distance,12);close(hit.point.x,600);
 const beyond=S.hitTest(path,{x:1100,y:100,r:20});assert(!beyond.hit);close(beyond.distance,100);
});
test('Billiard legs carry the medium index and time the ball at v = c/n',()=>{
 const s=S.defaults(),path=S.rays(s)[0],legs=S.billiardLegs(s,path);
 assert(legs.length===3);assert(legs[0].index===1.5&&legs[1].index===1.5&&legs[2].index===1);
 s.billiards.hole={x:30,y:30,r:20};const plan=S.shotPlan(s,path,400);assert(!plan.result.hit);
 close(plan.total,legs.reduce((t,l)=>t+l.length*l.index/400,0));
 close(plan.legs[1].duration/plan.legs[1].length,1.5*plan.legs[2].duration/plan.legs[2].length);
 const mid=S.ballAt(plan,plan.legs[0].duration/2);assert(mid.leg===0);close(mid.fraction,.5);
 const end=S.ballAt(plan,plan.total+1);assert(end.leg===2);close(end.fraction,1);close(P.length(P.sub(end.point,path.segments[2].to)),0);
 const outside=S.defaults();outside.source={x:100,y:300,angle:0,count:1};const legs2=S.billiardLegs(outside,S.rays(outside)[0]);
 assert(legs2.length===3&&legs2[0].index===1&&legs2[1].index===1.5&&legs2[2].index===1);
});
test('Shot plan stops the ball in the hole and a scan recovers a solution',()=>{
 const s=S.defaults(),path=S.rays(s)[0],last=path.segments[2],center=P.add(last.from,P.mul(P.sub(last.to,last.from),.5));
 s.billiards.hole={x:center.x,y:center.y,r:20};const plan=S.shotPlan(s,path);
 assert(plan.result.hit&&plan.result.segment===2);assert(plan.legs.length===3);close(P.length(P.sub(plan.legs[2].to,center)),0);
 assert(plan.total<S.shotPlan(s,{segments:path.segments,events:path.events},S.BALL_SPEED/2).total);
 const solution=S.findSolution(s);assert(solution!==null);
 assert(S.hitTest(P.trace(s.source,P.direction(solution),s.block,s.outsideIndex,s),s.billiards.hole).hit);
 s.billiards.hole={x:980,y:640,r:1};assert(S.findSolution(s)===null);
});
test('Moving the hole keeps it on the board and off the block',()=>{
 const s=S.defaults();S.randomTarget(s,lcg(9));const before={...s.billiards.hole};
 assert(!S.moveHole(s,{x:500,y:325}));assert(!S.moveHole(s,{x:330,y:325}));close(s.billiards.hole.x,before.x);assert(!s.billiards.moved);
 assert(S.moveHole(s,{x:900,y:80}));close(s.billiards.hole.x,900);close(s.billiards.hole.y,80);assert(s.billiards.moved&&s.billiards.solution===null);
 assert(S.moveHole(s,{x:5000,y:-50}));assert(s.billiards.hole.x<=s.width-s.billiards.hole.r&&s.billiards.hole.y>=s.billiards.hole.r);
});
test('Presets clear the hole and defaults start without one',()=>{
 const s=S.defaults();assert(s.billiards.hole===null&&s.billiards.attempts===0);S.randomTarget(s,lcg(2));assert(s.billiards.hole);
 S.applyPreset(s,'semicircle');assert(s.billiards.hole===null&&s.billiards.solution===null);
});
if(typeof document!=='undefined'){
 const list=document.getElementById('results');results.forEach(r=>{const li=document.createElement('li');li.textContent=`${r.pass?'PASS':'FAIL'} · ${r.name}${r.error?' — '+r.error:''}`;li.style.color=r.pass?'#126c68':'#b33';list.appendChild(li);});document.getElementById('summary').textContent=`${results.filter(r=>r.pass).length} / ${results.length} checks passed`;
}else{results.forEach(r=>console.log(`${r.pass?'PASS':'FAIL'} ${r.name}${r.error?' — '+r.error:''}`));if(results.some(r=>!r.pass))process.exitCode=1;}
})();
