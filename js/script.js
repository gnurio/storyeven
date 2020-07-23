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



drawLine();

$(document).ready(function () {

    

    $("#target").submit(function () {
        let area = $("#big-text").val();
        let words = area.split(" ");
        let length = words.length;
        alert(`The text has ${length} words and contains these words: ${words}`);
        $("#markdown-display").text(area);
    });

   


})

