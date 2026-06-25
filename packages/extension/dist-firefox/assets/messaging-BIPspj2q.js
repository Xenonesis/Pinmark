function o(e){return new Promise((r,s)=>{chrome.runtime.sendMessage(e,n=>{chrome.runtime.lastError?s(chrome.runtime.lastError):r(n)})})}export{o as s};
