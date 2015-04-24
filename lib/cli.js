// Include stuff
var inquirer = require("inquirer");
var clc = require('cli-color');

/**
 * Public scope
 */
var that = {
	/**
	 * Allow fatal errors to quit the process
	 */
	allowFatalToQuit: false,

	/**
	 * Show a notice (blue) to the CLI
	 */
	notice: function (pSubject)
	{
		console.log(""+pSubject);

		return pSubject;
	},

	/**
	 * Show a fatal error (red) to the CLI.
	 * If 'allowFatalToQuit' is set to true, process will be killed with error code in argument. 
	 */
	fatal: function (pSubject, pExitCode)
	{
		// Show the error on CLI
		that.error(pSubject);

		// Prompt exit with code
		that.promptExit(pExitCode);

		// Return the equivalent error
		return new Error(pSubject, pExitCode);
	},

	/**
	 * Line break
	 */
	br: function ()
	{
		console.log("");
	},

	/**
	 * Prompt user for exit.
	 * If 'allowFatalToQuit' is set to true, process will be killed with error code in argument. 
	 */
	promptExit: function (pExitCode)
	{
		// Pause CLI
		console.log("");
		inquirer.prompt({
			type: "input",
			message: exports.allowFatalToQuit ? "Quit" : "Continue",
			name: "Fatal error"
		}, function (pAnswer)
		{
			// Quit if allowed
			if (exports.allowFatalToQuit) process.exit(pExitCode);
		});
	},

	/**
	 * Show an error message (red) on the CLI
	 */
	error: function (pSubject)
	{
		console.log(clc.bgBlack.red(pSubject));

		return pSubject;
	},

	/**
	 * Show a warning message (orange) on the CLI
	 */
	warning: function (pSubject)
	{
		console.log(clc.yellow(pSubject));

		return pSubject;
	},

	/**
	 * Show a warning message (greeb) on the CLI
	 */
	success: function (pSubject)
	{
		console.log(clc.green(pSubject));

		return pSubject;
	}
};
module.exports = that;