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


$("#target").click(function (event) {

    let area = $("#big-text").val();
    let words = area.split(" ");
    let length = words.length;
    let alrt = `The text has ${length} words and contains these words: ${words}`;

    $("#markdown-display").text(alrt);

    event.preventDefault();
});

function setSelectionRange(input, selectionStart, selectionEnd) {
    if (input.setSelectionRange) {
        input.focus();
        input.setSelectionRange(selectionStart, selectionEnd);
    } else if (input.createTextRange) {
        var range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', selectionEnd);
        range.moveStart('character', selectionStart);
        range.select();
    }
}

function setCaretToPos(input, pos) {
    setSelectionRange(input, pos, pos);
};
$("#target").click(function(){
    setCaretToPos(document.getElementById("#big-text")[0],10);
});
