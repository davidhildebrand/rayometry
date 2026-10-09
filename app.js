(function(){
  'use strict';
  const P=Optics,S=BenchScene,M=BenchMeasurements,$=id=>document.getElementById(id),svg=$('board');
  let state=S.defaults(),traces=[],drag=null,notice='',anim=null;
  const deg=a=>a*180/Math.PI,rad=a=>a*Math.PI/180,fmt=a=>`${deg(a).toFixed(1)}°`;
  const point=p=>`${p.x},${p.y}`;
  const line=(a,b,attrs='')=>`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attrs}/>`;
  function circle(p,r,attrs=''){return `<circle cx="${p.x}" cy="${p.y}" r="${r}" ${attrs}/>`;}
  const schedule=callback=>{if(typeof requestAnimationFrame==='function')requestAnimationFrame(callback);};
  const middleRay=()=>traces[Math.floor(traces.length/2)];
  function currentEvent(){if(state.mode==='inspect'&&state.inspection)return traces[state.inspection.ray]?.events[state.inspection.hit];return middleRay()?.events[0];}
  // incidentOnly hides the outgoing angle, used before a billiards shot reveals the path.
  function annotation(e,incidentOnly=false){
    if(!e)return '';let out='';const q=e.point,n=e.normal;
    const showNormal=state.normal,showAngles=state.angles;
    if(showNormal)out+=line(P.add(q,P.mul(n,-78)),P.add(q,P.mul(n,78)),'class="normal"');
    if(showAngles){
      const pairs=[[n,P.mul(e.incoming,-1),e.incidence,'i'],[e.tir?n:P.mul(n,-1),e.direction,e.outgoingAngle,e.tir?'r':'t']];
      for(const [a,b,value,label]of incidentOnly?pairs.slice(0,1):pairs){
        const start=P.add(q,P.mul(a,36)),end=P.add(q,P.mul(b,36)),cross=a.x*b.y-a.y*b.x;
        if(value>1e-7)out+=`<path d="M ${point(start)} A 36 36 0 0 ${cross>=0?1:0} ${point(end)}" fill="none" stroke="${e.critical?'#8a481c':'#66889a'}" stroke-width="${e.critical?3:1.5}"/>`;
        const middle=P.unit(P.add(a,b)),pos=P.add(q,P.mul(middle,64));
        out+=`<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="middle" class="annotation${e.critical?' critical-label':''}">${e.critical&&label==='i'?'θc':label} ${fmt(value)}</text>`;
      }
    }return out;
  }
  function deviationAnnotation(path){
    const value=S.deviation(path);if(value===null)return '';
    const entry=path.events[0],exit=path.events[1],q=exit.point,a=entry.incoming,b=exit.direction;
    const signed=Math.atan2(a.x*b.y-a.y*b.x,P.dot(a,b)),radius=86;
    const start=P.add(q,P.mul(a,radius)),end=P.add(q,P.mul(b,radius));
    const label=P.add(q,P.mul(P.rotate(a,signed/2),110));
    let out='<g class="deviation-annotation" pointer-events="none">';
    out+=line(P.sub(q,P.mul(a,25)),P.add(q,P.mul(a,135)),'class="deviation-reference"');
    if(value>1e-7)out+=`<path d="M ${point(start)} A ${radius} ${radius} 0 0 ${signed>=0?1:0} ${point(end)}" class="deviation-arc"/>`;
    out+=`<text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="middle" class="annotation deviation-label">${S.minimumDeviation(state,path)?'δmin':'δ'} ${fmt(value)}</text></g>`;
    return out;
  }
  function rulerDrawing(){
    if(!state.ruler.visible)return '';
    const {a,b}=state.ruler,delta=P.sub(b,a),length=P.length(delta),d=length>1e-8?P.mul(delta,1/length):{x:1,y:0},normal={x:-d.y,y:d.x};
    let out='<g class="ruler-overlay">';
    out+=line(a,b,'stroke="#fff8e7" stroke-width="18" opacity=".9" data-ruler="body" class="ruler-drag"');
    out+=line(a,b,'stroke="#756035" stroke-width="1.5" pointer-events="none"');
    for(let tick=0;tick<=Math.floor(M.mm(length));tick++){
      const point=P.add(a,P.mul(d,tick/M.mmPerUnit)),size=tick%5===0?8:4;
      out+=line(point,P.add(point,P.mul(normal,size)),'stroke="#756035" stroke-width="1" pointer-events="none"');
    }
    for(const [key,point]of [['a',a],['b',b]]){
      out+=circle(point,16,`fill="transparent" data-ruler="${key}" class="ruler-drag"`);
      out+=circle(point,7,`fill="#fff8e7" stroke="#756035" stroke-width="2" data-ruler="${key}" class="ruler-drag"`);
      if(point.label)out+=`<text x="${Math.max(65,Math.min(935,point.x))}" y="${Math.max(18,Math.min(635,point.y+30))}" text-anchor="middle" class="annotation ruler-label">${point.label}</text>`;
    }
    const middle=P.add(P.mul(P.add(a,b),.5),P.mul(normal,-20));
    out+=`<text x="${Math.max(55,Math.min(945,middle.x))}" y="${Math.max(18,Math.min(632,middle.y))}" text-anchor="middle" class="annotation ruler-label">${M.distance(a,b).toFixed(2)} mm</text></g>`;
    return out;
  }
  function protractorDrawing(){
    const tool=state.protractor;if(!tool.visible)return '';
    const r=125;
    let out=`<g class="protractor-overlay" transform="translate(${tool.x} ${tool.y}) rotate(${deg(tool.angle)})">`;
    out+=`<path d="M ${-r} 0 A ${r} ${r} 0 0 1 ${r} 0 Z" fill="#e8f3f0" fill-opacity=".3" stroke="#426e67" stroke-width="1.3" data-protractor="move" class="ruler-drag"/>`;
    for(let angle=0;angle<=180;angle++){
      const d=P.direction(-rad(angle)),size=angle%10===0?12:angle%5===0?8:4;
      out+=line(P.mul(d,r-size),P.mul(d,r),'stroke="#426e67" stroke-width="1" pointer-events="none"');
      if(angle%10===0){const p=P.mul(d,r-23);out+=`<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="middle" fill="#31564f" font-size="9">${angle}</text>`;}
      if(angle%30===0){const p=P.mul(d,r-39);out+=`<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="middle" fill="#61877e" font-size="8">${180-angle}</text>`;}
    }
    out+=line({x:-r,y:0},{x:r+24,y:0},'stroke="#426e67" stroke-width="1.5" pointer-events="none"');
    out+=circle({x:0,y:0},15,'fill="transparent" data-protractor="move" class="ruler-drag"');
    out+=circle({x:0,y:0},5,'fill="white" stroke="#426e67" stroke-width="2" data-protractor="move" class="ruler-drag"');
    out+=line({x:-9,y:0},{x:9,y:0},'stroke="#426e67" pointer-events="none"');
    out+=line({x:0,y:-9},{x:0,y:9},'stroke="#426e67" pointer-events="none"');
    out+=circle({x:r+24,y:0},15,'fill="transparent" data-protractor="rotate" class="rotation"');
    out+=circle({x:r+24,y:0},7,'fill="white" stroke="#126c68" stroke-width="2" data-protractor="rotate" class="rotation"');
    const arm=P.mul(P.direction(-tool.measurement),r-7);
    out+=line({x:0,y:0},arm,'stroke="transparent" stroke-width="14" data-protractor="measure" class="rotation"');
    out+=line({x:0,y:0},arm,'stroke="#b5802e" stroke-width="2" pointer-events="none"');
    out+=circle(arm,7,'fill="#f4cf88" stroke="#875b21" stroke-width="1.5" data-protractor="measure" class="rotation"');
    // Keep the center grip above the measuring arm's hit area.
    out+=circle({x:0,y:0},11,'fill="transparent" data-protractor="move" class="ruler-drag"');
    out+=`<text x="0" y="27" text-anchor="middle" class="annotation ruler-label">${fmt(tool.measurement)}</text></g>`;
    return out;
  }
  function rayLine(segment){
    let out=line(segment.from,segment.to,'class="ray"');
    if(P.length(P.sub(segment.to,segment.from))>35){const mid=P.add(segment.from,P.mul(P.sub(segment.to,segment.from),.58)),before=P.sub(mid,P.mul(P.unit(P.sub(segment.to,segment.from)),13));out+=line(before,mid,'class="ray" marker-end="url(#arrow)"');}
    return out;
  }
  // Billiards: before the shot only the incident leg shows; the trail then follows the ball.
  function billiardsRays(path){
    const bb=state.billiards;let out='';
    if(bb.shot==='idle'||!bb.plan){if(path.segments[0])out+=rayLine(path.segments[0]);return out;}
    const plan=bb.plan,progress=bb.progress||{leg:plan.legs.length-1,fraction:1};
    plan.legs.forEach((leg,i)=>{
      if(i<progress.leg)out+=rayLine(leg);
      else if(i===progress.leg)out+=rayLine({from:leg.from,to:P.add(leg.from,P.mul(P.sub(leg.to,leg.from),progress.fraction))});
    });
    if(bb.shot==='miss'&&plan.result.point){
      const r=plan.result,mid=P.mul(P.add(r.point,bb.hole),.5);
      out+=line(r.point,bb.hole,'class="miss-gap"');
      out+=`<text x="${mid.x}" y="${mid.y-9}" text-anchor="middle" class="annotation verdict verdict-miss">closest approach ${M.mm(r.distance).toFixed(1)} mm</text>`;
    }
    if(bb.shot==='hit')out+=`<text x="${bb.hole.x}" y="${bb.hole.y+bb.hole.r+22}" text-anchor="middle" class="annotation verdict verdict-hit">Sunk!</text>`;
    return out;
  }
  function billiardsAnnotations(path){
    const bb=state.billiards,events=path.events;let out='';
    if(bb.shot==='idle'||!bb.plan){if(events[0])out+=annotation(events[0],true);return out;}
    const passed=bb.shot==='animating'?(bb.progress?bb.progress.leg:0):bb.shot==='hit'?bb.plan.legs.length-1:bb.plan.legs.length;
    events.forEach((e,i)=>{if(i<passed)out+=annotation(e);else if(i===passed&&bb.shot==='animating')out+=annotation(e,true);});
    return out;
  }
  function holeDrawing(){
    const bb=state.billiards,h=bb.hole;if(!h)return '';
    let out=`<g data-item="hole" class="hole${bb.shot==='animating'?'':' movable'}">`;
    out+=circle(h,h.r+10,'fill="transparent"');
    out+=circle(h,h.r,'fill="#2a3034" stroke="#6d7f76" stroke-width="3"');
    out+=circle(h,h.r*.55,'fill="#0f1416"');
    out+=`<text x="${h.x}" y="${h.y-h.r-10}" text-anchor="middle" class="annotation hole-label">target</text></g>`;
    return out;
  }
  // movable=true draws the ball at the source as a drag handle for repositioning it.
  function ballDrawing(p,r=9,opacity=1,movable=false){
    const open=movable?`<g class="ball movable" data-item="ball" opacity="${opacity}">${circle(p,20,'fill="transparent"')}`:`<g class="ball" pointer-events="none" opacity="${opacity}">`;
    return `${open}${circle(p,r+6,'fill="#ffd166" fill-opacity=".25"')}${circle(p,r,'fill="#fff1b8" stroke="#b8862b" stroke-width="2"')}${circle({x:p.x-r/3,y:p.y-r/3},r/3.5,'fill="#fff"')}</g>`;
  }
  function cueDrawing(){
    const bb=state.billiards,src=state.source;let out='';
    if(bb.shot!=='animating'){
      const tip=14+(bb.pull||0),butt=tip+170;
      out+=`<g transform="translate(${src.x} ${src.y}) rotate(${deg(src.angle)})" data-item="cue" class="cue"><line x1="${-tip-10}" y1="0" x2="${-butt}" y2="0" stroke="transparent" stroke-width="24"/><line x1="${-tip-8}" y1="0" x2="${-butt}" y2="0" stroke="#b68650" stroke-width="6" stroke-linecap="round" pointer-events="none"/><line x1="${-tip-75}" y1="0" x2="${-butt}" y2="0" stroke="#4a3220" stroke-width="9" stroke-linecap="round" pointer-events="none"/><line x1="${-tip}" y1="0" x2="${-tip-9}" y2="0" stroke="#dbe7ee" stroke-width="6" stroke-linecap="round" pointer-events="none"/></g>`;
    }
    if(bb.shot==='idle'||!bb.ball)out+=ballDrawing(src,9,1,true);
    else if(bb.shot==='hit'){out+=ballDrawing(src,9,.3,true);out+=ballDrawing(bb.hole,6);}
    else if(bb.shot==='miss'){out+=ballDrawing(src,9,.3,true);out+=ballDrawing(bb.ball,9,.55);}
    else out+=ballDrawing(bb.ball);
    return out;
  }
  function billiardsStatus(){
    const bb=state.billiards;
    if(!bb.hole)return 'Press New target to place a hole.';
    if(bb.shot==='animating')return 'Photon in flight…';
    if(bb.shot==='hit')return `Sunk after ${bb.attempts} attempt${bb.attempts===1?'':'s'}! Press New target for another hole.`;
    if(bb.shot==='miss')return `Missed. The ball passed ${M.mm(bb.plan.result.distance).toFixed(1)} mm from the center of the hole. Re-aim and shoot again.`;
    if(drag&&drag.type==='cue')return 'Release to shoot. How far you pull does not matter, only the direction.';
    const reach=bb.solution===null?'No aim was found that sinks the hole from here. Move the ball or the hole, or press New target. ':bb.moved?'A solution exists for this ball and hole. ':'A reachable hole has been placed. ';
    return reach+'Aim with the incident ray, the white handle or the Aim box, then pull the cue back and release. Drag the ball to move it.';
  }
  function render(){
    traces=S.rays(state);const b=state.block,src=state.source,edit=state.mode==='edit',billiards=state.mode==='billiards',bb=state.billiards,middle=middleRay(),curve=b.shape==='semicircle'?P.curvedGeometry(b):null;
    const corners=P.worldVertices(b),preset=S.presets[b.shape||'rectangle'];
    let out=`<defs><pattern id="grid" width="${M.gridStep}" height="${M.gridStep}" patternUnits="userSpaceOnUse"><circle cx="${M.gridStep/2}" cy="${M.gridStep/2}" r="1.2" fill="#bdcbbb"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 1 L 9 5 L 0 9" fill="none" stroke="#ce8734" stroke-width="1.5"/></marker></defs><rect width="1000" height="650" fill="${state.grid?'url(#grid)':'#fcfdf9'}"/>`;
    const materialStyle=`fill="#dcefeb" fill-opacity=".68" stroke="${state.selected==='block'&&edit?'#16827b':'#80aaa3'}" stroke-width="2" data-item="block" class="${edit?'movable':''}"`;
    if(b.shape==='semicircle'){
      out+=`<path d="M 0 ${-curve.halfHeight} A ${curve.radius} ${curve.radius} 0 0 1 0 ${curve.halfHeight} Z" transform="translate(${b.x} ${b.y}) rotate(${deg(b.angle)})" ${materialStyle}/>`;
      const vertex=P.add(b,P.rotate({x:curve.sag,y:0},b.angle)),center=P.add(b,P.rotate(curve.center,b.angle));
      out+=line(P.add(b,P.rotate({x:-60,y:0},b.angle)),P.add(b,P.rotate({x:curve.sag+65,y:0},b.angle)),'stroke="#8bada4" stroke-dasharray="3 6" pointer-events="none"');
      for(const [position,label]of [[center,'C'],[vertex,'A']]){out+=circle(position,3,'fill="#668b83" pointer-events="none"');out+=`<text x="${position.x}" y="${position.y+19}" class="annotation" text-anchor="middle">${label}</text>`;}
    }else out+=`<polygon points="${corners.map(point).join(' ')}" ${materialStyle}/>`;
    const label=P.add(b,P.rotate(b.shape==='semicircle'?{x:8,y:115}:b.vertices?{x:-35,y:85}:{x:-b.width/2+16,y:b.height/2-16},b.angle));
    out+=`<text x="${label.x}" y="${label.y}" fill="#668b83" font-size="12" transform="rotate(${deg(b.angle)} ${label.x} ${label.y})">${b.vertices?'PRISM':'GLASS'} · n = ${b.index}</text>`;
    if(preset.corners)corners.forEach((vertex,i)=>{
      const pos=P.add(vertex,P.mul(P.sub(b,vertex),.18));
      out+=`<text x="${pos.x}" y="${pos.y}" text-anchor="middle" class="annotation prism-corner">${preset.corners[i]}°${i===0?' apex':''}</text>`;
    });
    if(state.extensions&&!billiards)M.extensions(state,traces).forEach(segment=>{out+=line(segment.from,segment.to,'class="internal-extension"');});
    const revealed=billiards&&(bb.shot==='hit'||bb.shot==='miss'),aiming=billiards&&bb.shot!=='animating';
    if(billiards){
      out+=holeDrawing();
      out+=billiardsRays(middle);
      if(aiming&&middle.segments[0])out+=line(middle.segments[0].from,middle.segments[0].to,'stroke="transparent" stroke-width="18" pointer-events="stroke" data-rotate="source" class="rotation"');
      out+=billiardsAnnotations(middle);
      if(state.showDeviation&&revealed)out+=deviationAnnotation(middle);
      out+=cueDrawing();
    }else{
      traces.forEach(t=>t.segments.forEach(seg=>{out+=rayLine(seg);}));
      // Emphasize the grazing exit segment without changing the underlying physics.
      traces.forEach(t=>t.events.forEach((e,i)=>{if(e.critical){
        const segment=t.segments[i+1];
        if(segment)out+=line(segment.from,segment.to,'class="ray critical-ray"');
        out+=circle(e.point,7,'fill="#fff3dc" stroke="#8a481c" stroke-width="2.5" pointer-events="none"');
      }}));
      // A generous invisible stroke makes the incident ray easy to grab in either mode.
      if(edit)traces.forEach(t=>{const segment=t.segments[0];if(segment)out+=line(segment.from,segment.to,'stroke="transparent" stroke-width="18" pointer-events="stroke" data-rotate="source" class="rotation"');});
      if(!edit&&state.showAllAngles)traces.forEach(path=>path.events.forEach(event=>{out+=annotation(event);}));
      else out+=annotation(currentEvent());
      if(edit)middle.events.forEach(e=>{if(e.critical&&e!==currentEvent())out+=annotation(e);});
      traces.forEach((t,ri)=>t.events.forEach((e,hi)=>{
        const eligible=state.mode==='inspect';
        if(eligible)out+=circle(e.point,13,`fill="#fff" fill-opacity=".01" stroke="#137c75" stroke-dasharray="3 3" data-ray="${ri}" data-hit="${hi}" class="hit-target"`);
      }));
      if(state.showDeviation)out+=deviationAnnotation(middle);
      out+=`<g transform="translate(${src.x} ${src.y}) rotate(${deg(src.angle)})" data-item="source" class="${edit?'movable':''}"><rect x="-25" y="-16" width="43" height="32" rx="7" fill="#324f4e" stroke="${state.selected==='source'&&edit?'#1e9b8e':'#fff'}" stroke-width="2"/><path d="M -12 0 H 12 M 5 -6 L 12 0 L 5 6" fill="none" stroke="#f9d497" stroke-width="2"/><rect x="18" y="-9" width="5" height="18" rx="2" fill="#dba450"/></g>`;
      if(state.pivot){out+=circle(state.pivot.point,8,'fill="#fff" stroke="#126c68" stroke-width="2"');out+=`<text x="${state.pivot.point.x+13}" y="${state.pivot.point.y-14}" class="annotation">Pivot</text>`;}
      if(!edit&&currentEvent()){
        const selected=currentEvent().point;
        out+=circle(selected,18,'class="selected-intersection" fill="none" stroke="#126c68" stroke-width="3" pointer-events="none"');
        out+=circle(selected,5,'fill="#126c68" stroke="white" stroke-width="2" pointer-events="none"');
      }
    }
    if(edit||aiming){const item=edit?state[state.selected]:src,r=edit&&state.selected==='block'?b.width/2+36:64,handle=P.add(item,P.rotate({x:r,y:0},item.angle));out+=line(item,handle,'stroke="#559a8e" stroke-dasharray="3 4" pointer-events="none"');out+=circle(handle,17,'fill="transparent" data-rotate="true" class="rotation"');out+=circle(handle,8,'fill="#fff" stroke="#16827b" stroke-width="2" data-rotate="true" class="rotation"');}
    if(edit&&state.selected==='block'&&curve){
      const tip=P.add(b,P.rotate({x:curve.sag,y:0},b.angle));
      out+=circle(tip,18,'fill="transparent" data-curvature="true" class="curvature-handle"');
      out+=`<path d="M ${tip.x} ${tip.y-9} L ${tip.x+9} ${tip.y} L ${tip.x} ${tip.y+9} L ${tip.x-9} ${tip.y} Z" fill="#e8b759" stroke="#78501a" stroke-width="2" data-curvature="true" class="curvature-handle"/>`;
    }
    const scaleLeft=900-10/M.mmPerUnit,scaleRight=900+10/M.mmPerUnit;
    out+=line({x:scaleLeft,y:615},{x:scaleRight,y:615},'stroke="#668176" stroke-width="2" pointer-events="none"');
    out+=line({x:scaleLeft,y:610},{x:scaleLeft,y:620},'stroke="#668176" pointer-events="none"');
    out+=line({x:scaleRight,y:610},{x:scaleRight,y:620},'stroke="#668176" pointer-events="none"');
    out+='<text x="900" y="638" text-anchor="middle" fill="#587567" font-size="12">20 mm</text>';
    if(state.ruler.visible){
      const targets=M.targets(state,traces);
      for(const point of [state.ruler.a,state.ruler.b])if(point.label&&!targets.some(target=>target.label===point.label&&P.length(P.sub(target,point))<1e-6))delete point.label;
    }
    out+=protractorDrawing();
    out+=rulerDrawing();
    svg.innerHTML=out;
    const inspect=state.mode==='inspect';
    $('edit').setAttribute('aria-pressed',edit);$('inspect').setAttribute('aria-pressed',inspect);$('billiards').setAttribute('aria-pressed',billiards);
    for(const id of ['source-panel','toolbox-section','properties-section','media-section','try-section'])$(id).hidden=!edit;
    $('billiards-section').hidden=!billiards;
    if(billiards){
      $('billiards-score').innerHTML=`<div class="reading"><span>Attempts at this target</span><strong>${bb.attempts}</strong></div><div class="reading"><span>Targets sunk</span><strong>${bb.sunk} / ${bb.targets}</strong></div>`;
      $('shoot').disabled=bb.shot!=='idle'||!bb.hole;$('retry').disabled=!revealed;$('aim').disabled=bb.shot==='animating';
      $('aim').value=Number(deg(src.angle).toFixed(2));
      $('billiards-status').textContent=billiardsStatus();
      const name=b.shape==='semicircle'?'semicircle':b.vertices?'prism':'block';
      $('speed-caption').textContent=`Speed v = c/n. Outside (n = ${state.outsideIndex.toFixed(2)}): ${(100/state.outsideIndex).toFixed(0)} % of c. Inside the ${name} (n = ${b.index.toFixed(2)}): ${(100/b.index).toFixed(0)} % of c.`;
    }
    $('inspect-help').hidden=!inspect;
    $('hide-all-angles').hidden=!inspect;
    $('hide-all-angles').setAttribute('aria-pressed',!state.normal&&!state.angles&&!state.showDeviation);
    $('show-all-angles').hidden=!inspect;
    $('show-all-angles').setAttribute('aria-pressed',state.showAllAngles);
    $('show-all-angles').textContent=state.showAllAngles?'Show selected only':'Show all angles';
    $('place-minimum').disabled=!edit||!b.vertices||b.index<=state.outsideIndex;
    $('source-settings').disabled=!edit;$('properties').disabled=!edit;$('media').disabled=!edit;
    $('select-source').setAttribute('aria-pressed',state.selected==='source');$('select-block').setAttribute('aria-pressed',state.selected==='block');
    $('selected-title').textContent=curve&&curve.sag<curve.halfHeight?'Curved block':preset.name;
    const iconShape=curve?'<path d="M 8 3 A 12 12 0 0 1 8 27 Z"/>':b.vertices?'<path d="M 15 3 L 27 27 H 3 Z"/>':'<rect x="3" y="6" width="24" height="18" rx="1"/>';
    $('object-tool-icon').innerHTML=`<svg viewBox="0 0 30 30" width="30" height="30" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${iconShape}</svg>`;
    $('object-tool-name').textContent=b.shape==='semicircle'?'Semicircle':b.vertices?'Prism':'Glass block';
    $('material-name').textContent=b.shape==='semicircle'?'Semicircle':b.vertices?'Prism':'Glass block';
    $('shape-preset').value=b.shape||'rectangle';
    $('try-content').innerHTML=b.shape==='semicircle'?'<p>Three rays enter the flat face at normal incidence, then converge after the curved face. C marks the center of curvature; A marks the curved vertex.</p><p>Select the block and drag its gold diamond to change curvature. Rotate it 180° to explore curved-face-first refraction.</p>':b.vertices?'<p>Choose Surface entry point to vary incidence at a fixed point. Use Inspect to read each interaction.</p><p>Vary the incident angle to explore emergence, total internal reflection, and minimum deviation. Change the refractive index to compare materials.</p>':'<p>Rotate the source until the light escapes through the upper surface. What changes at the critical angle?</p><p>Then drag the source outside the block to explore refraction on entry and exit.</p>';
    $('block-properties').textContent=curve?`Drag the gold diamond to flatten or round the curved face. Radius: ${M.mm(curve.radius).toFixed(2)} mm. The flat face stays fixed.`:'Drag the optical element or its rotation handle. Its size stays fixed.';

    $('radius-control').hidden=!curve;
    if(curve)$('radius-mm').value=Number(M.mm(curve.radius).toFixed(4));
    for(const item of ['source','block'])$(item+'-orientation').value=Number(deg(state[item].angle).toFixed(2));
    $('outside-index').value=state.outsideIndex;$('block-index').value=b.index;$('ray-count').value=src.count;
    $('pivot-mode').value=state.rotationMode;
    $('pivot-help').textContent=state.rotationMode==='surface'?(state.pivot?'Drag the source to choose a new entry point. Drag the incident ray or white handle to rotate around the marked point.':'Aim the source at the block to establish an entry point. Rotation needs a surface hit.'):'The source stays in place as its direction changes.';
    $('grid').checked=state.grid;
    $('show-ruler').setAttribute('aria-pressed',state.ruler.visible);
    $('show-protractor').setAttribute('aria-pressed',state.protractor.visible);
    $('protractor-help').hidden=!state.protractor.visible;
    $('ruler-snap').checked=state.ruler.snap;
    $('extensions').checked=state.extensions;
    $('extensions').disabled=!curve;
    $('extension-help').textContent=state.extensions?(M.extensions(state,traces).length?'Blue dashes extend internal rays beyond the flat exit without refracting again. They are construction lines, not light rays.':'Aim rays at the curved face first, with transmission through the flat exit, to show internal extensions.'):'Extend internal rays through the flat exit to locate where they would converge without exit refraction.';
    $('ruler-reading').textContent=state.ruler.visible?`Distance: ${M.distance(state.ruler.a,state.ruler.b).toFixed(2)} mm`:'Bench: 300 × 195 mm. Dot spacing: 5 mm.';
    $('showDeviation').checked=state.showDeviation;
    $('normal').checked=state.normal;$('angles').checked=state.angles;
    $('board-medium').textContent=`Surrounding medium · n = ${state.outsideIndex.toFixed(2)}`;
    $('hint').textContent=billiards?'Drag the incident ray or white handle to aim. Pull the cue back and release to shoot. Drag the hole to move it.':!edit?'Board locked. Click a surface intersection to inspect it.':'Drag the source to move. Drag its incident ray or white handle to rotate.';
    $('message').textContent=[notice,...new Set(traces.map(t=>t.warning).filter(Boolean))].filter(Boolean).join(' ');
    if(state.showDeviation&&(!billiards||revealed)){const value=S.deviation(middle);$('message').textContent+=(notice?' ':'')+(value===null?' Deviation needs a direct entry-and-exit path.':' Dashed purple line: parallel to the original incoming ray (middle ray in a bundle).');}
    const e=currentEvent(),hidden=billiards&&!revealed;$('readout-title').textContent=inspect&&state.inspection?`Surface ${state.inspection.hit+1} · ray ${state.inspection.ray+1}`:'First surface';
    $('readout').innerHTML=!e?`<p class="help">${billiards?'Aim the ball at the block to see its first surface.':'Aim a ray at the block to inspect an interaction.'}</p>`:hidden?`<span class="badge" style="background:#e7eef3;color:#3d5a6b">Outcome hidden until the shot</span><div class="reading"><span>Incident angle · i</span><strong>${fmt(e.incidence)}</strong></div><div class="reading"><span>Indices · incident → next</span><strong>${e.n1} → ${e.n2}</strong></div>`:`${e.tir?'<span class="badge">Total internal reflection</span>':e.critical?'<span class="badge critical-badge">Critical angle · grazing ray</span>':'<span class="badge" style="background:#e0eee6;color:#387269">Refraction</span>'}<div class="reading"><span>Incident angle · i</span><strong>${fmt(e.incidence)}</strong></div><div class="reading"><span>${e.tir?'Reflected · r':'Refracted · t'}</span><strong>${fmt(e.outgoingAngle)}</strong></div><div class="reading"><span>Indices · incident → next</span><strong>${e.n1} → ${e.n2}</strong></div>`;
    if(b.vertices&&!hidden){
      const path=middle,deviation=S.deviation(path),minimum=S.minimumDeviation(state,path);
      if(minimum)$('readout').innerHTML+='<span class="badge minimum-badge">Minimum deviation · i = emergence</span>';
      $('readout').innerHTML+=deviation===null?'<p class="help">Total deviation is shown for a direct entry-and-exit path.</p>':`<div class="reading${minimum?' minimum-reading':''}"><span>${minimum?'Minimum deviation · δmin':'Total deviation · δ'}</span><strong>${fmt(deviation)}</strong></div><p class="help">Between the incoming and emerging directions of the middle ray.</p>`;
      const critical=path.events.findIndex(e=>e.critical);
      if(edit&&critical>0)$('readout').innerHTML+=`<p class="badge critical-badge">Critical at surface ${critical+1} · θc ${fmt(path.events[critical].incidence)}</p>`;
    }
  }
  // Rotation preference persists; only its geometric pivot is recalculated.
  function refreshPivot(){state.pivot=null;if(state.rotationMode==='surface')S.lockPivot(state);}
  function boardPoint(event){return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
  svg.addEventListener('pointerdown',e=>{
    const protractor=e.target.closest('[data-protractor]');
    if(protractor&&state.protractor.visible){drag={type:'protractor',part:protractor.dataset.protractor,start:boardPoint(e),original:{...state.protractor}};svg.setPointerCapture(e.pointerId);return;}
    const ruler=e.target.closest('[data-ruler]');
    if(ruler&&state.ruler.visible){drag={type:'ruler',part:ruler.dataset.ruler,start:boardPoint(e),a:{...state.ruler.a},b:{...state.ruler.b}};svg.setPointerCapture(e.pointerId);return;}
    const hit=e.target.closest('[data-hit]');
    if(hit){if(state.mode==='inspect')state.inspection={ray:+hit.dataset.ray,hit:+hit.dataset.hit};render();return;}
    if(state.mode==='billiards'){
      const bb=state.billiards;if(bb.shot==='animating')return;
      const item=e.target.closest('[data-item]'),part=item?.dataset?.item,rotation=e.target.closest('[data-rotate]');
      if(part!=='cue'&&part!=='hole'&&part!=='ball'&&!rotation)return;
      notice='';const pos=boardPoint(e);
      if(bb.shot!=='idle')retry(false);
      if(part==='cue'){drag={type:'cue',start:pos,id:e.pointerId};bb.pull=0;}
      else if(part==='hole')drag={type:'hole',start:pos,original:{...bb.hole}};
      else if(part==='ball')drag={type:'ball',start:pos,original:{x:state.source.x,y:state.source.y}};
      else{
        if(Math.hypot(pos.x-state.source.x,pos.y-state.source.y)<1){drag=null;notice='Grab the ray a little farther from the ball to aim.';render();return;}
        drag={type:'aim',center:{x:state.source.x,y:state.source.y},pointerAngle:Math.atan2(pos.y-state.source.y,pos.x-state.source.x),rawAngle:state.source.angle};
      }
      svg.setPointerCapture(e.pointerId);render();return;
    }
    if(state.mode!=='edit')return;
    const curvature=e.target.closest('[data-curvature]'),rotation=e.target.closest('[data-rotate]'),item=e.target.closest('[data-item]');if(!rotation&&!item&&!curvature)return;
    notice='';if(curvature)state.selected='block';if(item)state.selected=item.dataset.item;if(rotation?.dataset?.rotate==='source')state.selected='source';
    const pos=boardPoint(e);drag={type:curvature?'curvature':rotation?'rotate':'move',start:pos,original:{...state[state.selected]},id:e.pointerId};
    if(rotation){
      const center=state.selected==='source'&&state.pivot?state.pivot.point:state[state.selected];
      if(Math.hypot(pos.x-center.x,pos.y-center.y)<1){drag=null;notice='Grab the ray a little farther from the pivot to rotate.';render();return;}
      drag.center={x:center.x,y:center.y};
      drag.pointerAngle=Math.atan2(pos.y-center.y,pos.x-center.x);
      drag.rawAngle=state[state.selected].angle;
    }
    svg.setPointerCapture(e.pointerId);render();
  });
  svg.addEventListener('pointermove',e=>{
    if(!drag)return;const pos=boardPoint(e),item=state[state.selected];notice='';
    if(drag.type==='cue'){
      // Pull distance is shown but deliberately has no effect on the shot.
      state.billiards.pull=Math.max(0,Math.min(70,-P.dot(P.sub(pos,drag.start),P.direction(state.source.angle))));
    }else if(drag.type==='hole'){
      S.moveHole(state,{x:drag.original.x+pos.x-drag.start.x,y:drag.original.y+pos.y-drag.start.y});
    }else if(drag.type==='ball'){
      state.source.x=Math.max(30,Math.min(970,drag.original.x+pos.x-drag.start.x));
      state.source.y=Math.max(30,Math.min(620,drag.original.y+pos.y-drag.start.y));
    }else if(drag.type==='aim'){
      const q=drag.center;if(Math.hypot(pos.x-q.x,pos.y-q.y)<1)return;
      const pointerAngle=Math.atan2(pos.y-q.y,pos.x-q.x),delta=Math.atan2(Math.sin(pointerAngle-drag.pointerAngle),Math.cos(pointerAngle-drag.pointerAngle));
      drag.rawAngle=Math.atan2(Math.sin(drag.rawAngle+delta),Math.cos(drag.rawAngle+delta));drag.pointerAngle=pointerAngle;
      state.source.angle=drag.rawAngle;
    }else if(drag.type==='protractor'){
      const tool=state.protractor;
      if(drag.part==='move'){tool.x=Math.max(15,Math.min(state.width-15,drag.original.x+pos.x-drag.start.x));tool.y=Math.max(15,Math.min(state.height-15,drag.original.y+pos.y-drag.start.y));}
      else if(P.length(P.sub(pos,tool))>1){
        if(drag.part==='rotate'){const start=Math.atan2(drag.start.y-tool.y,drag.start.x-tool.x),current=Math.atan2(pos.y-tool.y,pos.x-tool.x);tool.angle=drag.original.angle+current-start;}
        else{const local=P.rotate(P.sub(pos,tool),-tool.angle);tool.measurement=local.y>0?(local.x>=0?0:Math.PI):Math.atan2(-local.y,local.x);}
      }
    }else if(drag.type==='ruler'){
      if(drag.part==='body'){
        const dx=Math.max(-Math.min(drag.a.x,drag.b.x),Math.min(state.width-Math.max(drag.a.x,drag.b.x),pos.x-drag.start.x));
        const dy=Math.max(-Math.min(drag.a.y,drag.b.y),Math.min(state.height-Math.max(drag.a.y,drag.b.y),pos.y-drag.start.y));
        state.ruler.a={x:drag.a.x+dx,y:drag.a.y+dy};state.ruler.b={x:drag.b.x+dx,y:drag.b.y+dy};
      }else state.ruler[drag.part]=M.snap(pos,state,traces);
    }else if(drag.type==='curvature'){
      const local=P.rotate(P.sub(pos,state.block),-state.block.angle);
      S.setCurveDepth(state,local.x);
    }else if(drag.type==='move'){
      const next={...item,x:drag.original.x+pos.x-drag.start.x,y:drag.original.y+pos.y-drag.start.y};
      if(state.selected==='source'){next.x=Math.max(30,Math.min(970,next.x));next.y=Math.max(30,Math.min(620,next.y));Object.assign(item,next);}else if(S.blockFits(next,state))Object.assign(item,next);
      refreshPivot();
    }else{
      const q=drag.center;
      if(Math.hypot(pos.x-q.x,pos.y-q.y)<1)return;
      const pointerAngle=Math.atan2(pos.y-q.y,pos.x-q.x);
      const delta=Math.atan2(Math.sin(pointerAngle-drag.pointerAngle),Math.cos(pointerAngle-drag.pointerAngle));
      drag.rawAngle+=delta;
      changeAngle(state.selected==='source'?S.snapSourceAngle(state,drag.rawAngle):drag.rawAngle);
      drag.pointerAngle=pointerAngle;
    }render();
  });
  function endDrag(e){
    const finished=drag;drag=null;if(!finished)return;
    if(finished.type==='cue'){state.billiards.pull=0;if(e&&e.type==='pointercancel')render();else shoot();}
    else if(finished.type==='hole'||finished.type==='ball'){const bb=state.billiards;bb.moved=true;bb.solution=S.findSolution(state);render();}
  }
  svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);svg.addEventListener('lostpointercapture',endDrag);
  // --- Photon billiards: shot animation at v = c/n per leg. ---
  function shoot(){
    const bb=state.billiards;if(state.mode!=='billiards'||bb.shot!=='idle'||!bb.hole)return;
    const path=middleRay();
    if(!path||!path.segments.length){notice=path?.warning||'Move the ball off the surface first.';render();return;}
    bb.plan=S.shotPlan(state,path);bb.attempts++;bb.shot='animating';bb.pull=0;
    bb.ball={x:state.source.x,y:state.source.y};bb.progress={leg:0,fraction:0};
    anim={plan:bb.plan,start:null};notice=path.warning||'';
    render();schedule(frame);
  }
  function frame(now){
    if(!anim)return;if(anim.start===null)anim.start=now;
    const time=(now-anim.start)/1000,plan=anim.plan,bb=state.billiards;
    if(time>=plan.total){finishShot();return;}
    const at=S.ballAt(plan,time);if(at){bb.ball=at.point;bb.progress={leg:at.leg,fraction:at.fraction};}
    render();schedule(frame);
  }
  function finishShot(){
    const bb=state.billiards,plan=bb.plan;anim=null;
    bb.shot=plan.result.hit?'hit':'miss';
    bb.ball=plan.result.hit?{x:bb.hole.x,y:bb.hole.y}:plan.legs.length?{...plan.legs[plan.legs.length-1].to}:{x:state.source.x,y:state.source.y};
    bb.progress={leg:Math.max(0,plan.legs.length-1),fraction:1};
    // A target counts once, however many times it is sunk.
    if(plan.result.hit&&!bb.solved){bb.solved=true;bb.sunk++;}
    render();
  }
  function retry(draw=true){const bb=state.billiards;anim=null;bb.shot='idle';bb.ball=null;bb.plan=null;bb.progress=null;bb.pull=0;if(draw)render();}
  function setMode(mode){
    drag=null;anim=null;$('controls-panel').scrollTop=0;
    const bb=state.billiards;
    if(state.mode==='billiards'&&mode!=='billiards'){retry(false);refreshPivot();}
    state.mode=mode;
    if(mode==='edit')state.showAllAngles=false;
    state.inspection=mode==='inspect'&&middleRay()?.events[0]?{ray:Math.floor(traces.length/2),hit:0}:null;
    if(mode==='billiards'){
      retry(false);
      if(!bb.hole||!S.holeFits(state,bb.hole))S.randomTarget(state);
      else if(bb.moved||bb.solution===null)bb.solution=S.findSolution(state);
      else{const check=S.hitTest(P.trace(state.source,P.direction(bb.solution),state.block,state.outsideIndex,state),bb.hole);if(!check.hit)bb.solution=S.findSolution(state);}
    }
    notice='';render();
  }
  $('shoot').onclick=()=>shoot();
  $('retry').onclick=()=>retry();
  $('new-target').onclick=()=>{anim=null;drag=null;notice=S.randomTarget(state)?'':'No reachable hole was found for this scene. Change the block or ball position in Edit.';render();};
  $('aim').onchange=e=>{const v=e.target.valueAsNumber;notice='';if(state.billiards.shot==='animating')return;if(Number.isFinite(v)){if(state.billiards.shot!=='idle')retry(false);state.source.angle=rad(((v%360)+540)%360-180);}else notice='Enter a finite aim angle.';render();};
  function changeAngle(angle,item=state.selected){if(item==='source'){if(state.rotationMode==='surface'&&!state.pivot){notice='Aim the source at a surface before rotating around an entry point.';return;}if(!S.rotateSource(state,angle))notice='Rotation stopped: keep the selected surface point as the first hit and the source on the board.';}else{const candidate={...state.block,angle};if(S.blockFits(candidate,state))state.block.angle=angle;else notice='Keep the block inside the workspace.';refreshPivot();}}
  ['source','block'].forEach(item=>$('select-'+item).onclick=()=>{state.selected=item;render();});
  $('radius-mm').onchange=e=>{notice=M.setRadius(state,e.target.valueAsNumber)?'':'Enter a radius from 45 to 117 mm. The previous curve was kept.';render();};
  $('show-ruler').onclick=()=>{state.ruler.visible=!state.ruler.visible;drag=null;render();};
  $('show-protractor').onclick=()=>{state.protractor.visible=!state.protractor.visible;drag=null;render();};
  $('ruler-snap').onchange=e=>{state.ruler.snap=e.target.checked;render();};
  for(const item of ['source','block'])$(item+'-orientation').onchange=e=>{const v=e.target.valueAsNumber;notice='';if(Number.isFinite(v))changeAngle(rad(((v%360)+540)%360-180),item);else notice='Enter a finite orientation.';render();};
  for(const [id,key]of [['outside-index','outsideIndex'],['block-index','index']])$(id).onchange=e=>{const value=e.target.valueAsNumber;notice='';if(Number.isFinite(value)&&value>0){if(key==='index')state.block.index=value;else state.outsideIndex=value;}else notice='Use a finite refractive index greater than zero. The previous value was kept.';render();};
  for(const [id,kind]of [['place-minimum','minimum'],['place-critical','critical']])$(id).onclick=()=>{const result=S.placeAtSpecialAngle(state,kind);notice=result.message;drag=null;render();};
  $('shape-preset').onchange=e=>{S.applyPreset(state,e.target.value);drag=null;notice='';render();};
  $('ray-count').onchange=e=>{state.source.count=+e.target.value;render();};
  $('pivot-mode').onchange=e=>{notice='';state.rotationMode=e.target.value;refreshPivot();render();};
  ['normal','angles','showDeviation','grid','extensions'].forEach(key=>$(key).onchange=e=>{state[key]=e.target.checked;render();});
  $('show-all-angles').onclick=()=>{if(state.mode!=='inspect')return;state.normal=true;state.angles=true;state.showAllAngles=!state.showAllAngles;render();};
  $('hide-all-angles').onclick=()=>{if(state.mode!=='inspect')return;state.normal=false;state.angles=false;state.showDeviation=false;state.showAllAngles=false;render();};
  ['edit','inspect','billiards'].forEach(mode=>$(mode).onclick=()=>setMode(mode));
  $('reset').onclick=()=>{state=S.defaults();drag=null;anim=null;notice='';render();};
  render();
})();
