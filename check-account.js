var puppeteer = require('puppeteer-extra');

var {executablePath} = require('puppeteer')

// add stealth plugin and use defaults (all evasion techniques)
var StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function checkAccount(accountName, password) {
    var browser = await puppeteer.launch({
      // headless: false,
      executablePath: executablePath(),
    });
    var context = await browser.createIncognitoBrowserContext();
    // Create a new page in a pristine context.
    var page = await context.newPage();
    var timeout = 50000;
    page.setDefaultTimeout(timeout);

    {
        var targetPage = page;
        var promises = [];
        promises.push(targetPage.waitForNavigation({waitUntil: 'networkidle0'}));
        await targetPage.goto("https://www.michaels.com/Account");
        await Promise.all(promises);
    }
    {
        var targetPage = page;
        var element = await waitForSelectors([["#dwfrm_login_username"]], targetPage, { timeout, visible: true });
        await scrollIntoViewIfNeeded(element, timeout);
        var type = await element.evaluate(el => el.type);
        if (["select-one"].includes(type)) {
          await element.select(accountName);
        } else if (["textarea","text","url","tel","search","password","number","email"].includes(type)) {
          await element.type(accountName);
        } else {
          await element.focus();
          await element.evaluate((el, value) => {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, accountName);
        }
    }
    {
        var targetPage = page;
        var element = await waitForSelectors([["#dwfrm_login_password"]], targetPage, { timeout, visible: true });
        await scrollIntoViewIfNeeded(element, timeout);
        var type = await element.evaluate(el => el.type);
        if (["select-one"].includes(type)) {
          await element.select(password);
        } else if (["textarea","text","url","tel","search","password","number","email"].includes(type)) {
          await element.type(password);
        } else {
          await element.focus();
          await element.evaluate((el, value) => {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          },password);
        }
    }
    {
        var targetPage = page;
        var promises = [];
        promises.push(targetPage.waitForNavigation({waitUntil: 'networkidle0'}));
        var element = await waitForSelectors([["aria/SIGN IN[role=\"button\"]"],["#signInRegister > button"]], targetPage, { timeout, visible: true });
        await scrollIntoViewIfNeeded(element, timeout);
        await element.click();
        await Promise.all(promises);
    }

    var result = await page.evaluate(() => document.querySelector('body').innerText.includes("Order History"));
    await browser.close();
    return result ? 'OK' : 'NG';

    async function waitForSelectors(selectors, frame, options) {
      for (var selector of selectors) {
        try {
          return await waitForSelector(selector, frame, options);
        } catch (err) {
          console.error(err);
        }
      }
      throw new Error('Could not find element for selectors: ' + JSON.stringify(selectors));
    }

    async function scrollIntoViewIfNeeded(element, timeout) {
      await waitForConnected(element, timeout);
      var isInViewport = await element.isIntersectingViewport({threshold: 0});
      if (isInViewport) {
        return;
      }
      await element.evaluate(element => {
        element.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'auto',
        });
      });
      await waitForInViewport(element, timeout);
    }

    async function waitForConnected(element, timeout) {
      await waitForFunction(async () => {
        return await element.getProperty('isConnected');
      }, timeout);
    }

    async function waitForInViewport(element, timeout) {
      await waitForFunction(async () => {
        return await element.isIntersectingViewport({threshold: 0});
      }, timeout);
    }

    async function waitForSelector(selector, frame, options) {
      if (!Array.isArray(selector)) {
        selector = [selector];
      }
      if (!selector.length) {
        throw new Error('Empty selector provided to waitForSelector');
      }
      let element = null;
      for (let i = 0; i < selector.length; i++) {
        var part = selector[i];
        if (element) {
          element = await element.waitForSelector(part, options);
        } else {
          element = await frame.waitForSelector(part, options);
        }
        if (!element) {
          throw new Error('Could not find element: ' + selector.join('>>'));
        }
        if (i < selector.length - 1) {
          element = (await element.evaluateHandle(el => el.shadowRoot ? el.shadowRoot : el)).asElement();
        }
      }
      if (!element) {
        throw new Error('Could not find element: ' + selector.join('|'));
      }
      return element;
    }

    async function waitForElement(step, frame, timeout) {
      var count = step.count || 1;
      var operator = step.operator || '>=';
      var comp = {
        '==': (a, b) => a === b,
        '>=': (a, b) => a >= b,
        '<=': (a, b) => a <= b,
      };
      var compFn = comp[operator];
      await waitForFunction(async () => {
        var elements = await querySelectorsAll(step.selectors, frame);
        return compFn(elements.length, count);
      }, timeout);
    }

    async function querySelectorsAll(selectors, frame) {
      for (var selector of selectors) {
        var result = await querySelectorAll(selector, frame);
        if (result.length) {
          return result;
        }
      }
      return [];
    }

    async function querySelectorAll(selector, frame) {
      if (!Array.isArray(selector)) {
        selector = [selector];
      }
      if (!selector.length) {
        throw new Error('Empty selector provided to querySelectorAll');
      }
      let elements = [];
      for (let i = 0; i < selector.length; i++) {
        var part = selector[i];
        if (i === 0) {
          elements = await frame.$$(part);
        } else {
          var tmpElements = elements;
          elements = [];
          for (var el of tmpElements) {
            elements.push(...(await el.$$(part)));
          }
        }
        if (elements.length === 0) {
          return [];
        }
        if (i < selector.length - 1) {
          var tmpElements = [];
          for (var el of elements) {
            var newEl = (await el.evaluateHandle(el => el.shadowRoot ? el.shadowRoot : el)).asElement();
            if (newEl) {
              tmpElements.push(newEl);
            }
          }
          elements = tmpElements;
        }
      }
      return elements;
    }

    async function waitForFunction(fn, timeout) {
      let isActive = true;
      setTimeout(() => {
        isActive = false;
      }, timeout);
      while (isActive) {
        var result = await fn();
        if (result) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('Timed out');
    }
}

module.exports = checkAccount;