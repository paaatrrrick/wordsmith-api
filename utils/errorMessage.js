const errorMessage = (req, res, next) => {
    console.log('at erorr message');
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(500).send(JSON.stringify("ERROR"));
};


//export the error message as default
module.exports = errorMessage;