import 'line';
import "../line";
import { drawLine } from '../line';
import voca from 'voca';
const words = require('voca/words');

drawLine();

$(document).ready(function () {
    $("#target").submit(function () {
        let area = $("#big-text").val();
        let wordSplit = words(area);
        let length = wordSplit.length;
        alert(`The text has ${length} words and contains these words: ${wordSplit}`);
    });
})

