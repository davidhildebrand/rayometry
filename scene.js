/* Scene state and constraints, independent of rendering. */
(function(root){
  'use strict';
  const P=root.Optics, radians=d=>d*Math.PI/180;
  const presets={
    rectangle:{name:'Rectangular block'},
    semicircle:{name:'Semicircular block'},
    prism45:{name:'45°–45°–90° prism',corners:[45,45,90],vertices:[{x:-120,y:-240},{x:240,y:120},{x:-120,y:120}]},
    prism30:{name:'30°–60°–90° prism',corners:[30,60,90],vertices:[{x:-120/Math.sqrt(3),y:-240},{x:240/Math.sqrt(3),y:120},{x:-120/Math.sqrt(3),y:120}]},
    equilateral:{name:'Equilateral prism',corners:[60,60,60],vertices:[{x:-60*Math.sqrt(3),y:-180},{x:120*Math.sqrt(3),y:0},{x:-60*Math.sqrt(3),y:180}]}
  };
  // A preset replaces the one solid object and aims a ray at the midpoint of its left face.
  function applyPreset(s,key){
    const preset=presets[key];if(!preset)return false;
    if(key==='rectangle'){
      const fresh=defaults();s.block={...fresh.block,index:s.block.index};
      s.source={...fresh.source,count:s.source.count};
    }else if(key==='semicircle'){
      s.block={x:450,y:325,angle:0,index:s.block.index,shape:key,radius:150,width:300,height:300};
      s.source={x:250,y:325,angle:0,count:3};
    }else{
      const v=preset.vertices.map(p=>({...p}));
      s.block={x:560,y:355,angle:0,index:s.block.index,shape:key,vertices:v,
        width:Math.max(...v.map(p=>p.x))-Math.min(...v.map(p=>p.x)),height:360};
      const entry=P.add(s.block,P.mul(P.add(v[0],v[2]),.5)),angle=radians(-20);
      s.source={...P.sub(entry,P.mul(P.direction(angle),220)),angle,count:s.source.count};
    }
    s.pivot=null;s.inspection=null;
    if(s.billiards){s.billiards.hole=null;s.billiards.solution=null;}
    if(s.rotationMode==='surface')lockPivot(s);
    return true;
  }
  function deviation(path){
    if(path.events.length!==2||path.events.some(e=>e.tir||e.critical))return null;
    const first=path.events[0],last=path.events[1];
    return Math.acos(Math.max(-1,Math.min(1,P.dot(first.incoming,last.direction))));
  }
  function minimumDeviation(s,path){
    // Symmetric two-face transmission is the minimum for a denser prism in one surrounding medium.
    if(!s.block.vertices||s.block.vertices.length!==3||s.block.index<=s.outsideIndex||P.location(s.source,s.block)!=='outside'||deviation(path)===null)return false;
    const [entry,exit]=path.events;
    return Math.abs(entry.incidence-exit.outgoingAngle)<1e-8&&Math.abs(entry.outgoingAngle-exit.incidence)<1e-8;
  }
  function defaults(){return {width:1000,height:650,grid:true,extensions:false,protractor:{visible:false,x:250,y:220,angle:0,measurement:Math.PI/4},ruler:{visible:false,snap:true,a:{x:650,y:550},b:{x:850,y:550}},source:{x:420,y:350,angle:radians(-40),count:1},block:{x:500,y:325,width:360,height:240,angle:0,index:1.5},outsideIndex:1,selected:'source',mode:'edit',normal:true,angles:true,showDeviation:false,rotationMode:'source',showAllAngles:false,pivot:null,inspection:null,billiards:billiardsDefaults()};}
  function rays(s){const offsets=s.source.count===1?[0]:s.source.count===3?[-18,0,18]:[-24,-12,0,12,24];return offsets.map(offset=>{
    const start=P.add(s.source,P.rotate({x:0,y:offset},s.source.angle));
    return P.trace(start,P.direction(s.source.angle),s.block,s.outsideIndex,s);
  });}
  function inBoard(p,s,margin=10){return p.x>=margin&&p.x<=s.width-margin&&p.y>=margin&&p.y<=s.height-margin;}
  function blockFits(b,s){return P.worldVertices(b).every(p=>inBoard(p,s));}
  function setCurveDepth(s,depth){
    if(s.block.shape!=='semicircle'||!Number.isFinite(depth))return false;
    const g=P.curvedGeometry(s.block),sag=Math.max(g.halfHeight/5,Math.min(g.halfHeight,depth));
    const candidate={...s.block,halfHeight:g.halfHeight,sag};
    if(!blockFits(candidate,s))return false;
    s.block=candidate;s.pivot=null;
    if(s.rotationMode==='surface')lockPivot(s);
    return true;
  }
  function lockPivot(s){const all=rays(s),hit=all[Math.floor(all.length/2)].events[0];if(!hit){s.pivot=null;return false;}s.pivot={point:{...hit.point},face:hit.face,distance:P.length(P.sub(s.source,hit.point))};return true;}
  function rotateSource(s,angle){
    if(!Number.isFinite(angle)) return false;
    if(!s.pivot){s.source.angle=angle;return true;}
    // Walk the requested arc to prevent jumping through an invalid pivot orientation.
    let delta=Math.atan2(Math.sin(angle-s.source.angle),Math.cos(angle-s.source.angle));
    const initial=s.source.angle,steps=Math.max(1,Math.ceil(Math.abs(delta)/radians(1)));let accepted=true;
    for(let i=1;i<=steps;i++){
      const a=initial+delta*i/steps,d=P.direction(a),p=P.sub(s.pivot.point,P.mul(d,s.pivot.distance));
      const hit=P.intersect(p,d,s.block);
      if(!inBoard(p,s,30)||!hit||hit.corner||hit.face!==s.pivot.face||P.length(P.sub(hit.point,s.pivot.point))>1e-4){accepted=false;break;}
      Object.assign(s.source,p,{angle:a});
    }
    return accepted;
  }
  // Find a nearby exact critical angle along the current path, including a prism's exit face.
  // Candidate scenes preserve the pivot and the preceding sequence of face interactions.
  function snapSourceAngle(s,angle){
    function probe(a){const trial={...s,source:{...s.source}};if(!rotateSource(trial,a))return null;const paths=rays(trial);return paths[Math.floor(paths.length/2)];}
    const initial=probe(angle);if(!initial)return angle;
    let best=angle,distance=Infinity;
    initial.events.forEach((hit,index)=>{
      if(hit.n1<=hit.n2)return;
      const critical=Math.asin(hit.n2/hit.n1);
      if(Math.abs(hit.incidence-critical)>radians(.35))return;
      function sample(a){const path=probe(a);if(!path)return null;
        for(let j=0;j<=index;j++)if(!path.events[j]||path.events[j].face!==initial.events[j].face||path.events[j].n1!==initial.events[j].n1||path.events[j].n2!==initial.events[j].n2)return null;
        return path.events[index];
      }
      let target=angle;
      for(let step=0;step<6;step++){
        const e=sample(target);if(!e)return;
        const error=e.incidence-critical;if(Math.abs(error)<1e-13)break;
        const h=1e-6,near=sample(target+h);if(!near)return;
        const slope=(near.incidence-e.incidence)/h;if(Math.abs(slope)<1e-7)return;
        target-=error/slope;if(Math.abs(target-angle)>radians(.35))return;
      }
      const e=sample(target),gap=Math.abs(target-angle);
      if(e?.critical&&gap<distance){best=target;distance=gap;}
    });
    if(s.block.vertices?.length===3&&s.block.index>s.outsideIndex&&deviation(initial)!==null){
      const [entry,exit]=initial.events;
      const apex=Math.acos(Math.max(-1,Math.min(1,P.dot(entry.normal,exit.normal))));
      const sine=s.block.index/s.outsideIndex*Math.sin(apex/2);
      if(sine<1){
        const inward=P.mul(entry.normal,-1),signed=Math.atan2(inward.x*entry.incoming.y-inward.y*entry.incoming.x,P.dot(inward,entry.incoming));
        const target=angle+Math.sign(signed)*(Math.asin(sine)-entry.incidence),gap=Math.abs(target-angle);
        if(gap<=radians(.35)&&gap<distance){
          const trial={...s,source:{...s.source}};
          if(rotateSource(trial,target)){
            const paths=rays(trial),path=paths[Math.floor(paths.length/2)];
            if(path.events[0]?.face===entry.face&&path.events[1]?.face===exit.face&&minimumDeviation(trial,path))best=target;
          }
        }
      }
    }
    return best;
  }
  function placeAtSpecialAngle(s,kind){
    const paths=rays(s),original=paths[Math.floor(paths.length/2)],entry=original.events[0];
    if(!entry)return {ok:false,message:'Aim the source at a surface first.'};
    const minimum=kind==='minimum';
    if(minimum&&(!s.block.vertices||s.block.vertices.length!==3||s.block.index<=s.outsideIndex||P.location(s.source,s.block)!=='outside'))return {ok:false,message:'Minimum deviation needs a denser triangular prism and a source outside it.'};
    const index=minimum?1:original.events.findIndex(e=>e.n1>e.n2);
    if(index<0||!original.events[index])return {ok:false,message:'This path has no higher-to-lower index surface for a critical angle.'};
    const targetEvent=original.events[index],critical=Math.asin(targetEvent.n2/targetEvent.n1);
    const pivot={point:{...entry.point},face:entry.face,distance:P.length(P.sub(s.source,entry.point))};
    // These placement buttons preserve entry point even when manual rotation uses the source pivot.
    function probe(angle){
      const trial={...s,source:{...s.source},pivot};if(!rotateSource(trial,angle))return null;
      const all=rays(trial),path=all[Math.floor(all.length/2)];
      for(let j=0;j<=index;j++)if(!path.events[j]||path.events[j].face!==original.events[j].face||path.events[j].n1!==original.events[j].n1||path.events[j].n2!==original.events[j].n2)return null;
      const event=path.events[index];
      return {trial,path,error:minimum?path.events[0].outgoingAngle-event.incidence:event.incidence-critical};
    }
    const inward=P.mul(entry.normal,-1),center=Math.atan2(inward.y,inward.x),candidates=[];
    function accept(result){if(result&&(minimum?minimumDeviation(result.trial,result.path):result.path.events[index].critical))candidates.push(result);}
    let previous=null;
    for(let step=0;step<=360;step++){
      const angle=center+radians(-89.9+179.8*step/360),result=probe(angle);
      if(result){
        if(Math.abs(result.error)<1e-12)accept(result);
        if(previous&&previous.result.error*result.error<0){
          let lo=previous.angle,hi=angle,left=previous.result,mid=null;
          for(let iteration=0;iteration<50;iteration++){
            const a=(lo+hi)/2;mid=probe(a);if(!mid)break;
            if(Math.abs(mid.error)<1e-13)break;
            if(left.error*mid.error<=0)hi=a;else{lo=a;left=mid;}
          }
          accept(mid);
        }
      }
      previous=result?{angle,result}:null;
    }
    candidates.sort((a,b)=>Math.abs(Math.atan2(Math.sin(a.trial.source.angle-s.source.angle),Math.cos(a.trial.source.angle-s.source.angle)))-Math.abs(Math.atan2(Math.sin(b.trial.source.angle-s.source.angle),Math.cos(b.trial.source.angle-s.source.angle))));
    if(!candidates.length)return {ok:false,message:'That angle is not reachable through these faces with the source on the bench. Move the source closer to the entry point and try again.'};
    s.source={...candidates[0].trial.source};s.pivot=s.rotationMode==='surface'?pivot:null;s.inspection=null;
    return {ok:true,message:minimum?'Placed at minimum deviation. Entry point preserved.':`Placed at the critical angle at surface ${index+1}. Entry point preserved.`};
  }
  // --- Photon billiards: the middle ray becomes a photon ball aimed at a hole. ---
  const HOLE_RADIUS=20,BALL_SPEED=400; // board units per second in a medium of n = 1
  function billiardsDefaults(){return {hole:null,solution:null,attempts:0,sunk:0,targets:0,solved:false,shot:'idle',ball:null,plan:null,progress:null,pull:0,moved:false};}
  function aimedPath(s,angle){return P.trace({x:s.source.x,y:s.source.y},P.direction(angle),s.block,s.outsideIndex,s);}
  // Each straight leg of a path with the refractive index the photon travels through.
  function billiardLegs(s,path){
    let inside=P.location(s.source,s.block)==='inside';const legs=[];
    path.segments.forEach((segment,i)=>{
      legs.push({from:{...segment.from},to:{...segment.to},index:inside?s.block.index:s.outsideIndex,length:P.length(P.sub(segment.to,segment.from))});
      const e=path.events[i];if(e&&!e.tir)inside=!inside;
    });
    return legs;
  }
  // The ball sinks on the first leg that passes within the hole radius; otherwise report the closest approach.
  function hitTest(path,hole){
    let best=null;
    for(let i=0;i<path.segments.length;i++){
      const {from,to}=path.segments[i],d=P.sub(to,from),len=P.length(d);if(len<1e-9)continue;
      const u=P.mul(d,1/len),t=Math.max(0,Math.min(len,P.dot(P.sub(hole,from),u)));
      const point=P.add(from,P.mul(u,t)),distance=P.length(P.sub(hole,point));
      if(distance<=hole.r)return {hit:true,segment:i,point,distance};
      if(!best||distance<best.distance)best={hit:false,segment:i,point,distance};
    }
    return best||{hit:false,segment:-1,point:null,distance:Infinity};
  }
  function holeFits(s,hole,margin=6){
    if(!hole||!inBoard(hole,s,hole.r+10)||P.location(hole,s.block)!=='outside')return false;
    for(let k=0;k<12;k++)if(P.location(P.add(hole,P.mul(P.direction(k*Math.PI/6),hole.r+margin)),s.block)!=='outside')return false;
    return true;
  }
  // Place the hole on the emerging leg of a random, valid path, so an exact solution always exists.
  function randomTarget(s,random=Math.random){
    const b=s.billiards||(s.billiards=billiardsDefaults());let fallback=null;
    function accept(candidate){Object.assign(b,candidate,{shot:'idle',ball:null,plan:null,progress:null,pull:0,attempts:0,solved:false,moved:false});b.targets++;return true;}
    for(let attempt=0;attempt<600;attempt++){
      const angle=random()*2*Math.PI-Math.PI,path=aimedPath(s,angle);
      if(path.warning||!path.events.length)continue;
      const last=path.segments[path.segments.length-1],d=P.sub(last.to,last.from),len=P.length(d);
      if(len<HOLE_RADIUS*4)continue;
      const t=len*(.35+.55*random()),hole={...P.add(last.from,P.mul(d,t/len)),r:HOLE_RADIUS};
      if(t<HOLE_RADIUS*2||!holeFits(s,hole)||P.length(P.sub(hole,s.source))<180)continue;
      const candidate={hole,solution:angle};
      // Prefer holes that cannot be reached by a straight shot around the block.
      const direct=P.intersect(s.source,P.unit(P.sub(hole,s.source)),s.block);
      if(direct&&direct.t<P.length(P.sub(hole,s.source)))return accept(candidate);
      fallback=fallback||candidate;
    }
    return fallback?accept(fallback):false;
  }
  function moveHole(s,point){
    const b=s.billiards;if(!b||!b.hole)return false;
    const r=b.hole.r,hole={...b.hole,x:Math.max(r+10,Math.min(s.width-r-10,point.x)),y:Math.max(r+10,Math.min(s.height-r-10,point.y))};
    if(!holeFits(s,hole))return false;
    b.hole=hole;b.moved=true;b.solution=null;return true;
  }
  // Scan aim angles for any path that sinks the ball; used after the hole or scene is changed by hand.
  function findSolution(s,hole=s.billiards&&s.billiards.hole,steps=1440){
    if(!hole)return null;let best=null;
    for(let k=0;k<steps;k++){
      const angle=-Math.PI+2*Math.PI*k/steps,path=aimedPath(s,angle);if(path.warning)continue;
      const result=hitTest(path,hole);
      if(result.hit&&(!best||result.distance<best.distance))best={angle,distance:result.distance};
    }
    return best?best.angle:null;
  }
  // Legs the ball actually travels, trimmed at the hole, with v = c/n timing.
  function shotPlan(s,path,speed=BALL_SPEED){
    const result=hitTest(path,s.billiards.hole),legs=billiardLegs(s,path).slice(0,result.hit?result.segment+1:undefined);
    if(result.hit&&legs.length){const last=legs[legs.length-1];last.to={...result.point};last.length=P.length(P.sub(last.to,last.from));}
    let elapsed=0;
    legs.forEach(leg=>{leg.start=elapsed;leg.duration=leg.length*leg.index/speed;elapsed+=leg.duration;});
    return {legs,result,total:elapsed};
  }
  function ballAt(plan,time){
    const legs=plan.legs;if(!legs.length)return null;
    for(let i=0;i<legs.length;i++){
      const leg=legs[i],last=i===legs.length-1;
      if(time<=leg.start+leg.duration||last){
        const fraction=leg.duration>0?Math.max(0,Math.min(1,(time-leg.start)/leg.duration)):1;
        return {point:P.add(leg.from,P.mul(P.sub(leg.to,leg.from),fraction)),leg:i,fraction};
      }
    }
    return null;
  }
  root.BenchScene={presets,applyPreset,deviation,minimumDeviation,defaults,rays,inBoard,blockFits,setCurveDepth,lockPivot,rotateSource,snapSourceAngle,placeAtSpecialAngle,
    HOLE_RADIUS,BALL_SPEED,billiardsDefaults,billiardLegs,hitTest,holeFits,randomTarget,moveHole,findSolution,shotPlan,ballAt};
  if(typeof module!=='undefined'&&module.exports) module.exports=root.BenchScene;
})(typeof globalThis!=='undefined'?globalThis:this);
