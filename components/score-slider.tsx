'use client';

import { useId, useState, type CSSProperties } from 'react';

type ScoreSliderProps = { name:string; label:string; defaultValue?:number|null; required?:boolean; help?:string|null };

export function ScoreSlider({name,label,defaultValue,required=false,help}:ScoreSliderProps){
  const id=useId();
  const [value,setValue]=useState<number|null>(defaultValue??(required?5:null));
  const sliderValue=value??5;
  const progress=value===null?0:((value-1)/9)*100;
  return <div className="score-slider-field">
    <div className="score-slider-heading">
      <label htmlFor={id}>{label} <span className="optional">{required?'Required':'Optional'}</span></label>
      <div className="score-slider-value"><span className="score-slider-output" aria-hidden="true">{value===null?<strong className="score-unset">Not set</strong>:<><strong>{value.toFixed(1)}</strong><span>/10</span></>}</span>{!required&&value!==null&&<button type="button" onClick={()=>setValue(null)}>Clear</button>}</div>
    </div>
    {help&&<span className="field-help">{help}</span>}
    <div className="score-slider-control" style={{'--score-progress':`${progress}%`} as CSSProperties}>
      <input id={id} aria-label={`${label} ${required?'Required':'Optional'}`} name={value===null?undefined:name} type="range" min="1" max="10" step="0.5" value={sliderValue} onChange={event=>setValue(Number(event.currentTarget.value))} required={required}/>
      <div className="score-slider-grid" aria-hidden="true">{Array.from({length:10},(_,index)=><span key={index}/>)}</div>
    </div>
    <div className="score-slider-scale" aria-hidden="true"><span>1</span><span>Drag in 0.5 steps</span><span>10</span></div>
  </div>;
}
