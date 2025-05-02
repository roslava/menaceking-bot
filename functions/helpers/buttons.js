const { Markup } = require('telegraf');

function generateMultiButtons(options, selected, type) {
    return Markup.inlineKeyboard(
        options.map(option => {
            const isSelected = selected.includes(option);
            return Markup.button.callback(
                `${isSelected ? '✅ ' : ''}${option}`,
                `${type}_${option.replace(/\s+/g, '_').toLowerCase()}`
            );
        }).concat([Markup.button.callback('Done', `${type}_done`)]),
        { columns: 2 }
    );
}

module.exports = { generateMultiButtons };