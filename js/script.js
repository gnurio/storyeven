function drawLine() {

    let c = document.getElementById('the-line');
    let ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(400, 0);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#747e86';
    ctx.stroke();
}

const chunk = (str, n) => {
    let ret = [];
    let i;
    let len;

    for(i = 0, len = str.length; i<len;i+=n){
        ret.push(str.substr(i,n))
    }
    return ret
}

drawLine();


$(document).ready(function () {
    $("#target").click(function (event) {
        event.preventDefault();
        area = $("#big-text").val();
        splitText = area.split(" ").toString();
        let returns = chunk(splitText,300).join('## Heading ##');
        len = splitText.length;
        len <= 300 ? $("#markdown-display").text("Not long enough. Once you get to ~ 300 words, try me again!") : $("#markdown-display").text(returns);
        
    });



});

