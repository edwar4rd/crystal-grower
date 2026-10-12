# Crystal Grower: Czochralski Silicon Ingot Growth Simulator

An interactive educational simulator and visual explainer exploring the physics of **Czochralski (CZ) silicon single-crystal growth** for semiconductor manufacturing.

**Live Demo:** [https://edwar4rd.github.io/crystal-grower/](https://edwar4rd.github.io/crystal-grower/)

## Overview

Modern integrated circuits begin as pure single-crystal silicon boules pulled from molten silicon at 1414 °C. The quality and structural integrity of the crystal are governed by subtle balances between mechanical pulling, thermal gradients, and point defect formation.

This repository provides two interactive web experiences:
1. **Interactive Poster (`/index.html`)**: A guided, 4-step walkthrough of the key principles behind Czochralski growth.
2. **Full Puller Simulator (`/sandbox.html`)**: An open-ended sandbox furnace simulator with automatic diameter control (PID), scenario presets, real-time readouts, and cross-sectional defect mapping.

## Physical Model

The simulation implements a reduced-order physical model parameterized with realistic physical constants for silicon:

1. **Stefan Interface Heat Balance**:
   $$\rho \Delta H \cdot v_g = k_s G_s - k_l G_l$$
   - $k_s = 0.022\text{ W/(mm}\cdot\text{K)}$ (solid thermal conductivity)
   - $k_l = 0.060\text{ W/(mm}\cdot\text{K)}$ (liquid thermal conductivity)
   - $\rho = 2.33 \times 10^{-6}\text{ kg/mm}^3$ (density of solid silicon)
   - $\Delta H = 1.8 \times 10^6\text{ J/kg}$ (latent heat of fusion)

2. **Radius-Dependent Radiation Cooling**:
   $$G_s(R) = G_0 \left(1 + \frac{c}{R}\right)$$
   Thinner crystals radiate heat away faster, yielding much steeper axial gradients $G_s$.

3. **Meniscus Dynamics**:
   $$\frac{de}{dt} = v_p - v_g - \gamma e, \quad \frac{dR}{dt} = -\alpha e$$
   Pulling faster than crystallization elevates the meniscus ($e > 0$), tapering the contact angle inward and shrinking the radius.

4. **Voronkov Criterion**:
   $$\xi(r) = \frac{v_p}{G(r)}, \quad G(r) = G_s \left(1 + \kappa \left(\frac{r}{R}\right)^2\right)$$
   Radial cooling makes the crystal edge $\sim 12\%$ steeper than the center ($\kappa = 0.12$). The critical ratio is $\xi_c \approx 0.13\text{ mm}^2/(\text{min}\cdot\text{K})$ with a $\pm 12\%$ defect-free window.

5. **Automatic Diameter Control (PID)**:
   $$v_p(t) = v_{p0} + K_p (R - R_t) + K_d \dot{R} + K_i \int (R - R_t)\, dt$$

## Project Structure

```
crystal-grower/
├── index.html          # Interactive educational poster (4 cards)
├── sandbox.html        # Full CZ furnace simulator & dashboard
├── favicon.svg         # Ingot puller SVG favicon
├── css/
│   └── style.css       # Typography, card layouts, light/dark themes
├── js/
│   ├── common.js       # Shared UI utilities, range bindings, theme management
│   ├── physics.js      # Reduced-order CZ physics engine and ODE stepping
│   ├── render.js       # HTML5 Canvas 2D engine
│   ├── poster.js       # Card state machine and controllers for index.html
│   └── sandbox.js      # Simulator bindings and telemetry for sandbox.html
└── tests/
    └── physics.test.js # Deno test suite verifying physics model and ODE stability
```

## Running Locally

### Python
```bash
python3 -m http.server 8000
```
Then navigate to `http://localhost:8000/`.

### Node.js (npx)
```bash
npx serve .
```

### Direct Browser
You can also open `index.html` or `sandbox.html` directly in any modern web browser.

## Running Tests

Automated tests for the physics model, numerical stability, and ADC disturbance rejection can be executed using [Deno](https://deno.land/):

```bash
deno run --allow-read tests/physics.test.js
```
