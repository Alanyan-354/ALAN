'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="configuration-screen"><h1>Something interrupted your visit.</h1><p>We couldn’t load this page. Please try again.</p><button className="button button-primary" onClick={reset}>Try again</button></div>;}
