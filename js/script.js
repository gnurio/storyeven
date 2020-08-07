const drawLine = () => {

    let c = document.getElementById('the-line');
    let ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(400, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#747e86';
    ctx.stroke();
}

const activateLine = () => {

    let c = document.getElementById('the-line');
    let ctx = c.getContext("2d");
    
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(20, 0);
    ctx.lineWidth = 4;
    ctx.lineCap = "round"
    ctx.strokeStyle = '#aade4a';
    ctx.stroke();
}


const chunkText = (str, n) => {
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
        let area = $("#big-text").val();
        let splitText = area.split(" ").toString();
        let chunks = chunkText(area,300*7).join('\n# Add a heading here\n');
        const regex = /[#]/g;
        let headingsCount = chunks.match(regex).length;
        console.log(headingsCount);
        let len = splitText.length;
        let md = window.markdownit();
        let mkdownChunks = md.render(chunks);
        
        if(len <= 300) {
            $("#markdown-display").text("Not long enough. Once you get to ~ 300 words, try me again!")}
            else {
                $("#markdown-display").html(mkdownChunks);
                activateLine();
           
            } 
        
    });



});

