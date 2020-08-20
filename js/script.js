const md = window.markdownit();// trying to use Markdown-it here
//const tokenize = new Tokenizer(); // but Tokenize-text doesn't have a link I can paste in HTML, so I need to use it here


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
    ctx.moveTo(0, 0);
    ctx.lineTo(400, 0);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000000';
    ctx.stroke();
}


const chunkText = (str, n) => {
    let ret = [];
    let i;
    let len;

    for (i = 0, len = str.length; i < len; i += n) {
        ret.push(str.substr(i, n))
    }
    return ret
}

const chunkTextArr = (arr, n) => {
    let newArr = arr.slice();
    let idx = n;
      while(idx <= newArr.length){
        newArr.splice(idx, 0,'\n# Add a heading here\n');
        idx += n + 1;
         }
      return newArr.join(' ');
    };
//TODO: Recognize end of sentences and paragraphs

drawLine();


$(document).ready(function () {
    $("#target").click(function (event) {
        event.preventDefault();
        let area = $("#big-text").val();
        let splitText = area.split(" ");
        
        let chunks = chunkTextArr(splitText, 250);
        
        let len = splitText.length;
        let mkdownChunks = md.render(chunks);

        if (len <= 300) {
            $("#markdown-display").text("Not long enough. Once you get to ~ 300 words, try me again!")
        } else {
            $("#markdown-display").html(mkdownChunks);
            activateLine();

        }

    });



});