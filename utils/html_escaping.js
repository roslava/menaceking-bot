function htmlEscaping(text) {

    if (!text) return '';
    return text.replace(/[&<>"']/g, function (m) {
        return {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '\''
        }[m] || m;
    });
};

module.exports = htmlEscaping;