let c = document.getElementById('the-line');
let ctx = c.getContext("2d");
ctx.beginPath();
ctx.moveTo(0,0);
ctx.lineTo(400,0);
ctx.lineWidth = 10;
ctx.strokeStyle = '#747e86';
ctx.stroke();
