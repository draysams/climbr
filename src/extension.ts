import * as vscode from 'vscode';

export const DEFAULT_SITTING_INTERVAL = 1;
export const DEFAULT_STANDING_INTERVAL = 1;
export function activate(context: vscode.ExtensionContext): void {
  const INACTIVE_THRESHOLD = 30;

  let sittingInterval: number =
    vscode.workspace.getConfiguration().get('climbr.sittingInterval') ??
    DEFAULT_SITTING_INTERVAL;
  let standingInterval: number =
    vscode.workspace.getConfiguration().get('climbr.standingInterval') ??
    DEFAULT_STANDING_INTERVAL;

  let isUserActive = true;
  let lastActiveTime = Date.now();
  let standingUpInterval: NodeJS.Timeout | undefined;
  let statusBarItem: vscode.StatusBarItem;

  let isAlreadyStanding = false;
  let standingTimer: NodeJS.Timeout | undefined;
  let reminderState: boolean = true;

  const getCurrentDateTime = (): string => {
    return new Date().toLocaleTimeString();
  };

  const getStatusBarText = (minutes: number, isSitting: boolean): string => {
    const minuteText = minutes === 1 ? 'minute' : 'minutes';
    return isSitting
      ? `Sit down in: ${minutes} ${minuteText}`
      : `Stand up in: ${minutes} ${minuteText}`;
  };

  function updateStatusBar(minutes: number, isSitting: boolean): void {
    if (reminderState) {
      if (statusBarItem) {
        statusBarItem.text = getStatusBarText(minutes, isSitting);
        statusBarItem.show();
      } else {
        statusBarItem = vscode.window.createStatusBarItem(
          vscode.StatusBarAlignment.Left,
          100
        );
        statusBarItem.text = getStatusBarText(minutes, isSitting);
        statusBarItem.show();
      }
    }
  }

  function clearStatusBar(): void {
    if (statusBarItem) {
      statusBarItem.hide();
    }
  }

  function updateSitDownAlertTimer(): void {
    if (standingTimer) {
      clearTimeout(standingTimer);
    }
    standingTimer = setTimeout(() => {
      vscode.window.showInformationMessage(
        `It's time to sit down! - @${getCurrentDateTime()}`
      );
      isAlreadyStanding = false;
      resetStandingUpTimer();
    }, sittingInterval * 60 * 1000); // Convert sittingInterval to milliseconds
  }

  function startStandingTimer(): void {
    if (!isAlreadyStanding) {
      isAlreadyStanding = true;
      updateSitDownAlertTimer();
    }
  }

  function resetStandingUpTimer(): void {
    if (reminderState) {
      if (standingUpInterval) {
        clearInterval(standingUpInterval);
      }

      isUserActive = true;
      lastActiveTime = Date.now();
      let remainingMinutes = isUserActive
        ? standingInterval
        : Math.max(
            0,
            standingInterval - Math.floor((Date.now() - lastActiveTime) / 60000)
          );
      updateStatusBar(remainingMinutes, isAlreadyStanding);

      standingUpInterval = setInterval(() => {
        if (isUserActive) {
          remainingMinutes--;
          updateStatusBar(remainingMinutes, isAlreadyStanding);
          if (remainingMinutes === 0) {
            vscode.window.showInformationMessage(
              `It's time to stand up! - @${getCurrentDateTime()}`
            );
            clearStatusBar();
            startStandingTimer();
            resetStandingUpTimer();
          }
        }
        if (
          !isUserActive &&
          Date.now() - lastActiveTime > INACTIVE_THRESHOLD * 60000
        ) {
          clearInterval(standingUpInterval);
        }
      }, 60 * 1000); // Update the status bar every 1 minute
    }
  }

  vscode.workspace.onDidChangeTextDocument(() => {
    if (reminderState) {
      isUserActive = true;
      lastActiveTime = Date.now();
      clearStatusBar();
      if (isAlreadyStanding) {
        updateSitDownAlertTimer();
      } else {
        resetStandingUpTimer();
      }
    }
  });

  vscode.window.onDidChangeTextEditorSelection(() => {
    if (reminderState) {
      isUserActive = true;
      lastActiveTime = Date.now();
      clearStatusBar();
      if (isAlreadyStanding) {
        updateSitDownAlertTimer();
      } else {
        resetStandingUpTimer();
      }
    }
  });

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('climbr.sittingInterval')) {
      sittingInterval =
        vscode.workspace.getConfiguration().get('climbr.sittingInterval') ??
        DEFAULT_SITTING_INTERVAL;
      clearStatusBar();
      resetStandingUpTimer();
    }
    if (event.affectsConfiguration('climbr.standingInterval')) {
      standingInterval =
        vscode.workspace.getConfiguration().get('climbr.standingInterval') ??
        DEFAULT_STANDING_INTERVAL;
      resetStandingUpTimer();
    }
  });

  context.subscriptions.push({
    dispose: () => {
      if (standingUpInterval) {
        clearInterval(standingUpInterval);
      }
      clearStatusBar();
    },
  });

  let disposableStart = vscode.commands.registerCommand(
    'climbr.startReminder',
    () => {
      if (!reminderState) {
        reminderState = true;
        resetStandingUpTimer();
        vscode.window.showInformationMessage(
          `Stand-up reminder started! - @${getCurrentDateTime()}`
        );
      } else {
        vscode.window.showInformationMessage(
          'Stand up reminder is already running.'
        );
      }
    }
  );

  let disposableStop = vscode.commands.registerCommand(
    'climbr.stopReminder',
    () => {
      if (reminderState) {
        reminderState = false;
        if (standingUpInterval) {
          clearInterval(standingUpInterval);
        }
        if (standingTimer) {
          clearInterval(standingTimer);
        }
        clearStatusBar();
        vscode.window.showInformationMessage(
          `Stand-up reminder stopped! - @${getCurrentDateTime()}`
        );
      } else {
        vscode.window.showInformationMessage(
          'There is no running reminder to stop.'
        );
      }
    }
  );

  context.subscriptions.push(disposableStart, disposableStop);

  vscode.commands.executeCommand('climbr.startReminder');
}

export function deactivate() {}
